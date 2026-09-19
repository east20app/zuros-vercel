from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import discord
import pytest
from discord import app_commands
from discord.ext import commands

from zuros_client.cogs.panel import PanelCog
from zuros_client.config import Settings
from zuros_client.main import ZurosClientBot, remove_legacy_commands


@pytest.mark.asyncio
async def test_panel_commands_are_synced_directly_to_the_guild(monkeypatch) -> None:
    settings = Settings(
        discord_token="test-token",
        zuros_client_bot_id="1455921050473988320",
        zuros_client_bot_secret="a" * 32,
    )
    bot = ZurosClientBot(settings)
    copy = Mock()
    sync = AsyncMock(return_value=[SimpleNamespace(name="apps"), SimpleNamespace(name="painel")])
    monkeypatch.setattr(bot.tree, "copy_global_to", copy)
    monkeypatch.setattr(bot.tree, "sync", sync)
    try:
        await bot.sync_guild_commands(123456789012345678)
        assert 123456789012345678 in bot._synced_guild_ids
        guild = sync.await_args.kwargs["guild"]
        assert guild.id == 123456789012345678
        copy.assert_called_once()
    finally:
        await bot.close()


@pytest.mark.asyncio
async def test_only_apps_and_admin_panel_remain_registered() -> None:
    bot = commands.Bot(command_prefix="!", intents=discord.Intents.none())

    @app_commands.command(name="apps")
    async def apps(interaction: discord.Interaction) -> None:
        pass

    @app_commands.command(name="comprar")
    async def comprar(interaction: discord.Interaction) -> None:
        pass

    try:
        bot.tree.add_command(apps)
        bot.tree.add_command(comprar)
        remove_legacy_commands(bot.tree)
        await bot.add_cog(PanelCog(bot))
        assert {command.name for command in bot.tree.get_commands()} == {"apps", "painel"}
        panel = bot.tree.get_command("painel")
        assert panel is not None
        assert panel.default_permissions is not None
        assert panel.default_permissions.administrator
    finally:
        await bot.close()
