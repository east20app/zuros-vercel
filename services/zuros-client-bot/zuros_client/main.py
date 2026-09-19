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


def align_authenticated_bot_id(settings: Settings, authenticated_id: int) -> bool:
    """Use the identity verified by Discord instead of a stale local ID."""
    actual_id = str(authenticated_id)
    if settings.zuros_client_bot_id == actual_id:
        return False
    settings.zuros_client_bot_id = actual_id
    return True


class ZurosClientBot(commands.Bot):
    def __init__(self, settings: Settings):
        intents = discord.Intents(guilds=True, message_content=True)
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)
        self.settings = settings
        self.api = ZurosClientApi(settings)
        self.ticket_store = TicketStore(settings.ticket_database_path)

    async def setup_hook(self) -> None:
        # discord.py has authenticated the token before calling setup_hook.
        # Use that verified identity for every API signature and bot header.
        if self.user and align_authenticated_bot_id(self.settings, self.user.id):
            logging.getLogger(__name__).warning(
                "ZUROS_CLIENT_BOT_ID local difere do bot autenticado; usando ID real %s",
                self.user.id,
            )
        await self.api.start()
        await self.ticket_store.initialize()
        application_id = self.settings.discord_application_id or self.application_id
        if application_id:
            await emoji.sync_application(
                int(application_id), self.settings.discord_token.get_secret_value()
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
        if self.settings.discord_guild_id:
            # Remove commands previously published globally as well as in this guild.
            await self.tree.sync()
            guild = discord.Object(id=self.settings.discord_guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()

    async def close(self) -> None:
        await self.api.close()
        await super().close()

    async def on_ready(self) -> None:
        logging.getLogger(__name__).info("Bot online como %s", self.user)


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
