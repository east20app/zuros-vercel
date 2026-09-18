import discord
from discord import app_commands
from discord.ext import commands

from ..api import ZurosClientApi
from ..config import Settings
from ..formatters import error_message
from ..models import Product
from .commerce import PlanSelect


def acquisition_text(products: list[Product]) -> str:
    lines = [
        "## 🛍️ Painel de Aquisição",
        "",
        "Bem-vindo(a) à Central de Compras ZUROS. Escolha no menu abaixo "
        "a aplicação que deseja adquirir e siga os passos da compra.",
        "",
        "### 🤖 Produtos disponíveis",
        "",
    ]
    if products:
        for product in products[:10]:
            description = product.description.strip() or "Aplicação pronta para sua operação."
            lines.append(f"> **{product.name}:** {description[:160]}")
    else:
        lines.append("> O catálogo está sendo atualizado. Tente novamente em instantes.")
    lines.extend(("", "-# ZUROS · Tecnologia e controle para o seu negócio."))
    return "\n".join(lines)


class AcquisitionProductSelect(discord.ui.Select["AcquisitionView"]):
    def __init__(self, products: list[Product]):
        available = [product for product in products if product.plans][:25]
        options = [
            discord.SelectOption(
                label=product.name[:100],
                value=product.id,
                description=(product.description[:100] or "Ver planos disponíveis"),
                emoji="🤖",
            )
            for product in available
        ]
        if not options:
            options = [
                discord.SelectOption(
                    label="Catálogo temporariamente indisponível",
                    value="unavailable",
                    emoji="⏳",
                )
            ]
        super().__init__(
            custom_id="zuros:acquisition:product",
            placeholder="Escolha uma aplicação para comprar",
            min_values=1,
            max_values=1,
            options=options,
            disabled=not available,
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            products = [product for product in await self.view.api.catalog() if product.plans]
            product = next((item for item in products if item.id == self.values[0]), None)
            if not product:
                await interaction.followup.send(
                    "Este produto não está mais disponível. Publique o painel novamente.",
                    ephemeral=True,
                )
                return
            view = discord.ui.View(timeout=300)
            view.add_item(PlanSelect(self.view.api, interaction.user.id, product))
            await interaction.followup.send(
                f"## {product.name}\n{product.description or 'Escolha o plano desejado.'}",
                view=view,
                ephemeral=True,
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class AcquisitionView(discord.ui.LayoutView):
    def __init__(self, api: ZurosClientApi, settings: Settings, products: list[Product]):
        super().__init__(timeout=None)
        self.api = api
        container = discord.ui.Container(accent_colour=0x2563EB)
        container.add_item(discord.ui.TextDisplay(acquisition_text(products)))
        container.add_item(discord.ui.Separator(spacing=discord.SeparatorSpacing.large))
        container.add_item(discord.ui.ActionRow(AcquisitionProductSelect(products)))
        container.add_item(
            discord.ui.ActionRow(
                discord.ui.Button(
                    label="Ver planos no site",
                    emoji="🌐",
                    style=discord.ButtonStyle.link,
                    url=str(settings.zuros_plans_url),
                ),
                discord.ui.Button(
                    label="Preciso de ajuda",
                    emoji="💬",
                    style=discord.ButtonStyle.link,
                    url=str(settings.zuros_support_url),
                ),
            )
        )
        self.add_item(container)


class AcquisitionCog(commands.Cog):
    def __init__(self, bot: commands.Bot, api: ZurosClientApi, settings: Settings):
        self.bot = bot
        self.api = api
        self.settings = settings

    @app_commands.command(
        name="aquisicao", description="Publique o painel de compras da ZUROS neste canal"
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def acquisition(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            products = [product for product in await self.api.catalog() if product.plans]
            if not interaction.channel:
                await interaction.followup.send(
                    "Não foi possível identificar o canal.", ephemeral=True
                )
                return
            await interaction.channel.send(view=AcquisitionView(self.api, self.settings, products))
            await interaction.followup.send(
                "Painel de aquisição publicado neste canal.", ephemeral=True
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AcquisitionCog(bot, bot.api, bot.settings))  # type: ignore[attr-defined]
