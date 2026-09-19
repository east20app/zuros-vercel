from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from ..config import Settings
from ..emojis import emoji
from ..theme import FOOTER, Accent


def central_text() -> str:
    return f"""## {emoji.zuros} Central ZUROS

Gerencie seus serviços por aqui, sem precisar decorar comandos.
Toque em uma opção e o painel será exibido **somente para você**.

### {emoji.robot} Gerenciar aplicações
-# Inicie, desligue, reinicie, atualize e configure seus bots.

### {emoji.cart} Comprar aplicações
-# Consulte os produtos, escolha um plano e gere o pagamento PIX.

### {emoji.reload} Renovar aplicações
-# Consulte seus bots e renove o plano sem sair do Discord.

### {emoji.website} Painel ZUROS
-# Acesse configurações avançadas, vendas e integrações pelo site.

{FOOTER.format(tagline="Central de controle · Os botões possuem uma pausa curta entre cliques")}
"""


CENTRAL_TEXT = central_text()


class CentralActionButton(discord.ui.Button["CentralView"]):
    def __init__(self, action: str, label: str, emoji: str, style: discord.ButtonStyle):
        super().__init__(
            label=label,
            emoji=emoji,
            style=style,
            custom_id=f"zuros:central:{action}",
        )
        self.action = action

    async def callback(self, interaction: discord.Interaction) -> None:
        cog_name = "ApplicationsCog" if self.action == "applications" else "CommerceCog"
        cog: Any = interaction.client.get_cog(cog_name)
        if cog is None:
            await interaction.response.send_message(
                "Este painel está temporariamente indisponível.", ephemeral=True
            )
            return
        if self.action == "applications":
            await cog.show_apps(interaction)
        elif self.action == "store":
            await cog.show_store(interaction)
        else:
            await cog.show_renewal(interaction)


class CentralView(discord.ui.LayoutView):
    def __init__(self, settings: Settings):
        super().__init__(timeout=None)
        actions = discord.ui.ActionRow(
            CentralActionButton(
                "applications", "Aplicações", emoji.robot, discord.ButtonStyle.primary
            ),
            CentralActionButton("store", "Comprar", emoji.cart, discord.ButtonStyle.success),
            CentralActionButton("renewal", "Renovar", emoji.reload, discord.ButtonStyle.secondary),
        )
        links = discord.ui.ActionRow(
            discord.ui.Button(
                label="Abrir painel",
                emoji=emoji.website,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_dashboard_url),
            ),
            discord.ui.Button(
                label="Suporte",
                emoji=emoji.speech,
                style=discord.ButtonStyle.link,
                url=str(settings.zuros_support_url),
            ),
        )
        container = discord.ui.Container(accent_colour=Accent.BRAND)
        container.add_item(discord.ui.TextDisplay(central_text()))
        container.add_item(discord.ui.Separator(spacing=discord.SeparatorSpacing.large))
        container.add_item(actions)
        container.add_item(links)
        self.add_item(container)


class CentralCog(commands.Cog):
    def __init__(self, bot: commands.Bot, settings: Settings):
        self.bot = bot
        self.settings = settings

    @app_commands.command(
        name="central", description="Publique a central interativa da ZUROS neste canal"
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def central(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        if not interaction.channel:
            await interaction.followup.send("Não foi possível identificar o canal.", ephemeral=True)
            return
        await interaction.channel.send(view=CentralView(self.settings))
        await interaction.followup.send("Central publicada neste canal.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(CentralCog(bot, bot.settings))  # type: ignore[attr-defined]
