import asyncio
import logging

import discord
from discord.ext import commands

from .api import ZurosClientApi
from .cogs.acquisition import AcquisitionView
from .cogs.central import CentralView
from .config import Settings, get_settings
from .emojis import emoji
from .security import secret_fingerprint
from .tickets.store import TicketStore


def remove_legacy_commands(tree: discord.app_commands.CommandTree) -> None:
    """Retire old slash entries while keeping their handlers for panel interactions."""
    for command in list(tree.get_commands()):
        if command.name != "apps":
            tree.remove_command(command.name)


class ZurosClientBot(commands.Bot):
    def __init__(self, settings: Settings):
        intents = discord.Intents(guilds=True, message_content=True)
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)
        self.settings = settings
        self.api = ZurosClientApi(settings)
        self.ticket_store = TicketStore(settings.ticket_database_path)
        self._synced_guild_ids: set[int] = set()
        self._emoji_sync_task: asyncio.Task[None] | None = None

    async def sync_guild_commands(self, guild_id: int) -> None:
        guild = discord.Object(id=guild_id)
        self.tree.copy_global_to(guild=guild)
        commands_synced = await self.tree.sync(guild=guild)
        self._synced_guild_ids.add(guild_id)
        logging.getLogger(__name__).info(
            "Comandos sincronizados no servidor %s: %s",
            guild_id,
            ", ".join(command.name for command in commands_synced),
        )

    async def setup_hook(self) -> None:
        await self.api.start()
        await self.ticket_store.initialize()
        application_id = self.settings.discord_application_id or self.application_id
        if application_id:
            await emoji.sync_application(
                int(application_id),
                self.settings.discord_token.get_secret_value(),
                upload_missing=False,
            )
        await self.load_extension("zuros_client.cogs.applications")
        await self.load_extension("zuros_client.cogs.commerce")
        await self.load_extension("zuros_client.cogs.central")
        await self.load_extension("zuros_client.cogs.acquisition")
        await self.load_extension("zuros_client.cogs.welcome")
        await self.load_extension("zuros_client.cogs.publisher")
        await self.load_extension("zuros_client.cogs.server_setup")
        await self.load_extension("zuros_client.cogs.live_status")
        await self.load_extension("zuros_client.cogs.tickets")
        # Keep legacy handlers available to the panel, but expose only two slash commands.
        remove_legacy_commands(self.tree)
        await self.load_extension("zuros_client.cogs.panel")
        self.add_view(CentralView(self.settings))
        self.add_view(AcquisitionView(self.api, self.settings, []))
        from .cogs.tickets import TicketControlView, TicketPanelView

        self.add_view(TicketPanelView())
        self.add_view(TicketControlView())
        try:
            global_commands = await self.tree.sync()
            logging.getLogger(__name__).info(
                "Comandos globais sincronizados: %s",
                ", ".join(command.name for command in global_commands),
            )
        except discord.HTTPException:
            logging.getLogger(__name__).exception(
                "Falha na sincronização global; tentarei registrar /apps e /painel por servidor"
            )
        if self.settings.discord_guild_id:
            try:
                await self.sync_guild_commands(self.settings.discord_guild_id)
            except discord.HTTPException:
                logging.getLogger(__name__).exception(
                    "Falha ao sincronizar /apps e /painel no servidor configurado %s",
                    self.settings.discord_guild_id,
                )
        if application_id:
            self._emoji_sync_task = asyncio.create_task(
                emoji.sync_application(
                    int(application_id), self.settings.discord_token.get_secret_value()
                )
            )

    async def close(self) -> None:
        if self._emoji_sync_task and not self._emoji_sync_task.done():
            self._emoji_sync_task.cancel()
        await self.api.close()
        await super().close()

    async def on_ready(self) -> None:
        logging.getLogger(__name__).info("Bot online como %s", self.user)
        for guild in self.guilds:
            if guild.id in self._synced_guild_ids:
                continue
            try:
                await self.sync_guild_commands(guild.id)
            except discord.HTTPException:
                logging.getLogger(__name__).exception(
                    "Falha ao sincronizar /apps e /painel no servidor %s", guild.id
                )

    async def on_guild_join(self, guild: discord.Guild) -> None:
        try:
            await self.sync_guild_commands(guild.id)
        except discord.HTTPException:
            logging.getLogger(__name__).exception(
                "Falha ao sincronizar /apps e /painel no novo servidor %s", guild.id
            )


def run() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger(__name__).info(
        "API=%s bot_id=%s assinatura=%s",
        settings.api_root,
        settings.zuros_client_bot_id,
        secret_fingerprint(settings.zuros_client_bot_secret.get_secret_value()),
    )
    bot = ZurosClientBot(settings)
    try:
        bot.run(settings.discord_token.get_secret_value(), log_handler=None)
    except KeyboardInterrupt:
        asyncio.run(bot.close())
    except discord.LoginFailure:
        logging.getLogger(__name__).error(
            "O Discord rejeitou DISCORD_TOKEN (401). Atualize o token do bot no ambiente "
            "de hospedagem com o valor atual do Discord Developer Portal e reinicie o serviço."
        )
        raise SystemExit(1) from None
