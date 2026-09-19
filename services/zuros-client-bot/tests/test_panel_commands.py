import discord
import pytest
from discord import app_commands
from discord.ext import commands

from zuros_client.cogs.panel import PanelCog
from zuros_client.config import Settings
from zuros_client.main import align_authenticated_bot_id, remove_legacy_commands


def test_api_uses_the_bot_id_verified_by_discord() -> None:
    settings = Settings(
        discord_token="test-token",
        zuros_client_bot_id="111111111111111111",
        zuros_client_bot_secret="a" * 32,
    )
    assert align_authenticated_bot_id(settings, 222222222222222222)
    assert settings.zuros_client_bot_id == "222222222222222222"
    assert not align_authenticated_bot_id(settings, 222222222222222222)


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
