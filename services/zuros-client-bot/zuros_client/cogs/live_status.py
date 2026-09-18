import logging

import discord
from discord.ext import commands, tasks

from ..api import ZurosClientApi

log = logging.getLogger(__name__)

STATUS_CATEGORY = "STATUS ZUROS"
ONLINE_PREFIX = "🟢 Apps online:"
PING_PREFIX = "📡 Ping:"


def status_names(online: int, ping_ms: int) -> tuple[str, str]:
    return f"{ONLINE_PREFIX} {online}", f"{PING_PREFIX} {ping_ms}ms"


class LiveStatusCog(commands.Cog):
    def __init__(self, bot: commands.Bot, api: ZurosClientApi):
        self.bot = bot
        self.api = api
        self.refresh_status.start()

    def cog_unload(self) -> None:
        self.refresh_status.cancel()

    @tasks.loop(minutes=2)
    async def refresh_status(self) -> None:
        try:
            stats = await self.api.stats()
            online = int(stats.get("online") or 0)
        except Exception as error:
            log.warning("Não foi possível atualizar os canais de status: %s", error)
            return
        ping_ms = max(0, round(self.bot.latency * 1000))
        online_name, ping_name = status_names(online, ping_ms)
        for guild in self.bot.guilds:
            category = discord.utils.find(
                lambda item: item.name.casefold() == STATUS_CATEGORY.casefold(),
                guild.categories,
            )
            if not category:
                continue
            for channel in category.voice_channels:
                try:
                    if channel.name.startswith(ONLINE_PREFIX) and channel.name != online_name:
                        await channel.edit(name=online_name, reason="Status automático ZUROS")
                    elif channel.name.startswith(PING_PREFIX) and channel.name != ping_name:
                        await channel.edit(name=ping_name, reason="Status automático ZUROS")
                except discord.HTTPException as error:
                    log.warning("Falha ao atualizar %s: %s", channel.id, error)

    @refresh_status.before_loop
    async def before_refresh_status(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(LiveStatusCog(bot, bot.api))  # type: ignore[attr-defined]
