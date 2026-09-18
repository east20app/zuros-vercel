import asyncio
import logging

import discord
from discord.ext import commands

from .api import ZurosClientApi
from .config import Settings, get_settings
from .security import secret_fingerprint


class ZurosClientBot(commands.Bot):
    def __init__(self, settings: Settings):
        super().__init__(
            command_prefix=commands.when_mentioned, intents=discord.Intents(guilds=True)
        )
        self.settings = settings
        self.api = ZurosClientApi(settings)

    async def setup_hook(self) -> None:
        await self.api.start()
        await self.load_extension("zuros_client.cogs.applications")
        await self.load_extension("zuros_client.cogs.commerce")
        if self.settings.discord_guild_id:
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
