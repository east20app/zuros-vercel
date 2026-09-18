import io

import discord
from discord import app_commands
from discord.ext import commands

from ..api import ZurosClientApi
from ..config import Settings
from ..formatters import error_message
from ..models import Application, Product


class PlanSelect(discord.ui.Select):
    def __init__(self, api: ZurosClientApi, owner_id: int, product: Product):
        self.api, self.owner_id, self.product = api, owner_id, product
        options = [
            discord.SelectOption(
                label=plan.label[:100],
                value=plan.id,
                description=f"R$ {plan.price:,.2f}".replace(",", "X")
                .replace(".", ",")
                .replace("X", "."),
            )
            for plan in product.plans[:25]
        ]
        super().__init__(placeholder="Escolha o plano", options=options)

    async def callback(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message(
                "Este painel pertence a outro usuário.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        try:
            cart = await self.api.create_purchase(
                str(interaction.user.id), self.product.store_id, self.product.id, self.values[0]
            )
            payment = await self.api.create_payment(str(interaction.user.id), str(cart["id"]))
            await send_payment(interaction, payment, f"Compra de {self.product.name}")
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


class ProductSelect(discord.ui.Select):
    def __init__(self, api: ZurosClientApi, owner_id: int, products: list[Product]):
        self.api, self.owner_id, self.products = (
            api,
            owner_id,
            {product.id: product for product in products},
        )
        super().__init__(
            placeholder="Escolha o produto",
            options=[
                discord.SelectOption(
                    label=item.name[:100], value=item.id, description=item.description[:100] or None
                )
                for item in products[:25]
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message(
                "Este painel pertence a outro usuário.", ephemeral=True
            )
            return
        product = self.products[self.values[0]]
        view = discord.ui.View(timeout=300)
        view.add_item(PlanSelect(self.api, self.owner_id, product))
        await interaction.response.edit_message(
            content=f"Produto: **{product.name}**\nEscolha o plano:", view=view
        )


class RenewalSelect(discord.ui.Select):
    PLANS = [
        ("weekly", "7 dias"),
        ("biweekly", "15 dias"),
        ("monthly", "30 dias"),
        ("lifetime", "Vitalício"),
    ]

    def __init__(self, api: ZurosClientApi, owner_id: int, app: Application):
        self.api, self.owner_id, self.app = api, owner_id, app
        super().__init__(
            placeholder="Escolha o plano de renovação",
            options=[
                discord.SelectOption(label=label, value=value)
                for value, label in self.PLANS
                if not (app.lifetime and value != "lifetime")
            ],
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message(
                "Este painel pertence a outro usuário.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        try:
            cart = await self.api.renew(str(interaction.user.id), self.app.id, self.values[0])
            payment = await self.api.create_payment(str(interaction.user.id), str(cart["id"]))
            await send_payment(interaction, payment, f"Renovação de {self.app.name}")
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


async def send_payment(
    interaction: discord.Interaction, payment: dict[str, object], title: str
) -> None:
    value = float(payment.get("finalPrice") or 0)
    code = str(payment.get("pixCopyPaste") or "")
    image = payment.get("pixQrCode")
    embed = discord.Embed(
        title=title,
        description=(
            f"Valor: **R$ {value:.2f}**\n"
            "Copie o código PIX abaixo. O pagamento é confirmado automaticamente."
        ),
        color=0x35C46A,
    )
    files: list[discord.File] = []
    if isinstance(image, str) and image:
        import base64

        try:
            files.append(discord.File(io.BytesIO(base64.b64decode(image)), filename="pix.png"))
            embed.set_image(url="attachment://pix.png")
        except Exception:
            pass
    await interaction.followup.send(
        content=f"```\n{code}\n```" if code else None, embed=embed, files=files, ephemeral=True
    )


class CommerceCog(commands.Cog):
    def __init__(self, bot: commands.Bot, api: ZurosClientApi, settings: Settings):
        self.bot, self.api, self.settings = bot, api, settings

    @app_commands.command(name="comprar", description="Compre uma aplicação ZUROS pelo Discord")
    async def comprar(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            products = [product for product in await self.api.catalog() if product.plans]
            if not products:
                await interaction.followup.send(
                    "Nenhum produto está disponível agora.", ephemeral=True
                )
                return
            view = discord.ui.View(timeout=300)
            view.add_item(ProductSelect(self.api, interaction.user.id, products))
            await interaction.followup.send("Escolha um produto:", view=view, ephemeral=True)
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)

    @app_commands.command(name="renovar", description="Renove uma aplicação ZUROS")
    async def renovar(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            apps = [
                app
                for app in await self.api.list_applications(str(interaction.user.id))
                if not app.lifetime
            ]
            if not apps:
                await interaction.followup.send(
                    "Você não possui aplicações que precisam de renovação.", ephemeral=True
                )
                return
            view = discord.ui.View(timeout=300)
            if len(apps) == 1:
                view.add_item(RenewalSelect(self.api, interaction.user.id, apps[0]))
                text = f"Renovar **{apps[0].name}**:"
            else:
                text = (
                    "Use `/app`, abra a aplicação desejada e consulte sua situação. "
                    "A seleção direta para múltiplas aplicações será adicionada na próxima versão."
                )
            await interaction.followup.send(
                text, view=view if len(apps) == 1 else None, ephemeral=True
            )
        except Exception as error:
            await interaction.followup.send(error_message(error), ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(CommerceCog(bot, bot.api, bot.settings))  # type: ignore[attr-defined]
