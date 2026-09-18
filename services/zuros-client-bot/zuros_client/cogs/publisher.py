import discord
from discord import app_commands
from discord.ext import commands

from ..api import ZurosClientApi
from ..config import Settings
from ..formatters import error_message
from .acquisition import AcquisitionView
from .central import CentralView
from .welcome import WelcomeView

PANEL_LABELS = {
    "central": "Central ZUROS",
    "aquisicao": "Painel de aquisição",
    "boas-vindas": "Boas-vindas",
}


class PublisherCog(commands.Cog):
    def __init__(self, bot: commands.Bot, api: ZurosClientApi, settings: Settings):
        self.bot = bot
        self.api = api
        self.settings = settings

    @app_commands.command(
        name="publicar-painel",
        description="Escolha um painel ZUROS e o canal em que ele será publicado",
    )
    @app_commands.describe(
        painel="Painel que será publicado",
        canal="Canal de texto que receberá o painel",
    )
    @app_commands.choices(
        painel=[
            app_commands.Choice(name="Central ZUROS", value="central"),
            app_commands.Choice(name="Painel de aquisição", value="aquisicao"),
            app_commands.Choice(name="Boas-vindas", value="boas-vindas"),
        ]
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def publish_panel(
        self,
        interaction: discord.Interaction,
        painel: app_commands.Choice[str],
        canal: discord.TextChannel,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            if painel.value == "aquisicao":
                products = [product for product in await self.api.catalog() if product.plans]
                view: discord.ui.LayoutView = AcquisitionView(self.api, self.settings, products)
            elif painel.value == "boas-vindas":
                view = WelcomeView(self.settings)
            else:
                view = CentralView(self.settings)
            await canal.send(view=view)
            await interaction.followup.send(
                f"**{PANEL_LABELS[painel.value]}** publicado em {canal.mention}.",
                ephemeral=True,
            )
        except discord.Forbidden:
            await interaction.followup.send(
                "Não tenho permissão para enviar mensagens nesse canal.", ephemeral=True
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(PublisherCog(bot, bot.api, bot.settings))  # type: ignore[attr-defined]
