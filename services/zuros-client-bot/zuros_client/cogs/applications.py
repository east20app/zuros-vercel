import discord
from discord import app_commands
from discord.ext import commands

from ..api import ZurosClientApi
from ..config import Settings
from ..emojis import emoji
from ..formatters import error_message
from ..theme import FOOTER, Accent
from ..views.apps import ApplicationListView, ApplicationView


class ApplicationsCog(commands.Cog):
    def __init__(self, bot: commands.Bot, api: ZurosClientApi, settings: Settings):
        self.bot, self.api, self.settings = bot, api, settings

    async def show_apps(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            apps = await self.api.list_applications(str(interaction.user.id))
            if not apps:
                view = discord.ui.LayoutView()
                links = discord.ui.ActionRow()
                links.add_item(
                    discord.ui.Button(
                        label="Conhecer os planos",
                        emoji=emoji.store,
                        url=str(self.settings.zuros_plans_url),
                        style=discord.ButtonStyle.link,
                    )
                )
                links.add_item(
                    discord.ui.Button(
                        label="Ajuda",
                        emoji=emoji.speech,
                        url=str(self.settings.zuros_support_url),
                        style=discord.ButtonStyle.link,
                    )
                )
                container = discord.ui.Container(accent_colour=Accent.BRAND)
                container.add_item(
                    discord.ui.TextDisplay(
                        f"## {emoji.robot} Aplicações ZUROS\n"
                        "Você ainda não possui aplicações.\n\n"
                        + FOOTER.format(tagline="Comece sua operação com a ZUROS")
                    )
                )
                container.add_item(links)
                view.add_item(container)
                await interaction.followup.send(view=view, ephemeral=True)
                return
            if len(apps) == 1:
                await interaction.followup.send(
                    view=ApplicationView(self.api, self.settings, interaction.user.id, apps[0]),
                    ephemeral=True,
                )
                return
            await interaction.followup.send(
                view=ApplicationListView(self.api, self.settings, interaction.user.id, apps),
                ephemeral=True,
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)

    @app_commands.command(name="app", description="Acesse e controle suas aplicações ZUROS")
    async def app(self, interaction: discord.Interaction) -> None:
        await self.show_apps(interaction)

    @app_commands.command(name="apps", description="Acesse e controle suas aplicações ZUROS")
    async def apps(self, interaction: discord.Interaction) -> None:
        await self.show_apps(interaction)

    @app_commands.command(
        name="status", description="Verifique a conexão do bot com a plataforma ZUROS"
    )
    async def status(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            await self.api.health()
            await interaction.followup.send(f"API ZUROS operacional {emoji.online}", ephemeral=True)
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ApplicationsCog(bot, bot.api, bot.settings))  # type: ignore[attr-defined]
