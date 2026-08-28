from disnake.ext import commands
import disnake

from functions.emoji import emoji
from functions.message import message, embed_message
from functions.database import database as db


class Loja(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def _primary_color():
        color_data = db.get_document("custom_colors") or {}
        primary_color_hex = color_data.get("primary")

        if not primary_color_hex:
            return None

        return int(primary_color_hex.replace("#", ""), 16)

    @staticmethod
    def _options():
        """Opções exibidas no menu exatamente como na referência visual."""
        extensions_emoji = getattr(emoji, "extensions", getattr(emoji, "members", "▦"))

        return [
            disnake.SelectOption(
                label="Gerenciar Produtos",
                value="produtos",
                emoji=emoji.cardbox,
                description="Crie, Configure e Edite seus produtos.",
            ),
            disnake.SelectOption(
                label="Personalizar Loja",
                value="personalizar",
                emoji=emoji.edit,
                description="Personalize sua loja com criatividade.",
            ),
            disnake.SelectOption(
                label="Preferências",
                value="preferencias",
                emoji=emoji.settings2,
                description="Configure preferências do seu sistema de loja.",
            ),
            disnake.SelectOption(
                label="Extensões",
                value="extensoes",
                emoji=extensions_emoji,
                description="Adicione extensões ao seu sistema de loja.",
            ),
        ]

    @staticmethod
    def _action_emojis():
        """Usa os emojis customizados do projeto quando eles existirem."""
        power_emoji = getattr(emoji, "power", "⏻")
        template_emoji = getattr(
            emoji,
            "templates",
            getattr(emoji, "save", getattr(emoji, "floppy", "▣")),
        )
        return power_emoji, template_emoji

    def _store_action_row(self):
        power_emoji, template_emoji = self._action_emojis()

        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Desligar Vendas",
                style=disnake.ButtonStyle.danger,
                emoji=power_emoji,
                custom_id="Loja_DesligarVendas",
            ),
            disnake.ui.Button(
                label="Templates",
                style=disnake.ButtonStyle.grey,
                emoji=template_emoji,
                custom_id="Loja_Templates",
            ),
        )

    def _back_row(self):
        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Voltar",
                style=disnake.ButtonStyle.grey,
                emoji=emoji.back,
                custom_id="PainelInicial",
            )
        )

    def panel(self, inter: disnake.MessageInteraction):
        mode_data = db.get_document("custom_mode") or {}
        mode = mode_data.get("mode", "components")

        if mode == "embed":
            return self._panel_embed(inter)
        return self._panel_components(inter)

    def _panel_components(self, inter: disnake.MessageInteraction) -> dict:
        primary_color = self._primary_color()
        container_kwargs = {}

        if primary_color is not None:
            container_kwargs["accent_colour"] = disnake.Colour(primary_color)

        return {
            "components": [
                disnake.ui.Container(
                    disnake.ui.TextDisplay(
                        f"# {emoji.zuros}\n-# Painel > **Loja**"
                    ),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(
                        "Configure a sua loja selecionando uma seção abaixo.\n"
                        "Para configurar as formas de pagamento, acesse as configurações."
                    ),
                    disnake.ui.Separator(),
                    disnake.ui.ActionRow(
                        disnake.ui.StringSelect(
                            custom_id="Loja_Select",
                            placeholder="Selecione uma seção para configurar",
                            options=self._options(),
                        )
                    ),
                    self._store_action_row(),
                    **container_kwargs,
                ),
                self._back_row(),
            ]
        }

    def _panel_embed(self, inter: disnake.MessageInteraction) -> dict:
        primary_color = self._primary_color()
        embed_kwargs = {}

        if primary_color is not None:
            embed_kwargs["color"] = primary_color

        embed = disnake.Embed(
            description=(
                f"-# Painel > **Loja**\n\n"
                "Configure a sua loja selecionando uma seção abaixo.\n"
                "Para configurar as formas de pagamento, acesse as configurações."
            ),
            **embed_kwargs,
        )

        components = [
            disnake.ui.ActionRow(
                disnake.ui.StringSelect(
                    custom_id="Loja_Select",
                    placeholder="Selecione uma seção para configurar",
                    options=self._options(),
                )
            ),
            self._store_action_row(),
            self._back_row(),
        ]

        return {"embed": embed, "components": components}

    async def _show_panel(self, inter: disnake.MessageInteraction):
        mode_data = db.get_document("custom_mode") or {}
        mode = mode_data.get("mode", "components")
        msg_handler = embed_message if mode == "embed" else message
        await msg_handler.wait(inter, send=False)

        panel_data = self.panel(inter)

        if "embed" in panel_data:
            await inter.edit_original_message(content=None, **panel_data)
        else:
            await inter.edit_original_message(
                **panel_data,
                flags=disnake.MessageFlags(is_components_v2=True),
            )

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        custom_id = inter.component.custom_id

        if custom_id == "Painel_Loja" or custom_id == "Loja_Panel":
            await self._show_panel(inter)

        elif custom_id == "Loja_DesligarVendas":
            await inter.response.send_message(
                "A função de vendas foi selecionada.",
                ephemeral=True,
            )

        elif custom_id == "Loja_Templates":
            await inter.response.send_message(
                "O painel de templates foi selecionado.",
                ephemeral=True,
            )

    @commands.Cog.listener("on_dropdown")
    async def on_dropdown(self, inter: disnake.MessageInteraction):
        if inter.component.custom_id != "Loja_Select":
            return

        choice = inter.values[0]
        mode_data = db.get_document("custom_mode") or {}
        mode = mode_data.get("mode", "components")
        msg_handler = embed_message if mode == "embed" else message
        await msg_handler.wait(inter, send=False)

        if choice == "produtos":
            from .products.cog import GerenciarProdutos
            panel_data = GerenciarProdutos(self.bot).panel(inter)
        elif choice == "personalizar":
            from .personalization.cog import PersonalizarLoja
            panel_data = PersonalizarLoja.panel(inter)
        elif choice == "preferencias":
            from .preferences.cog import PreferenciasLoja
            panel_data = PreferenciasLoja.panel(inter)
        elif choice == "extensoes":
            await inter.response.send_message(
                "O painel de extensões será configurado em breve.",
                ephemeral=True,
            )
            return
        else:
            panel_data = self.panel(inter)

        if isinstance(panel_data, tuple):
            embed, components = panel_data
            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )
        elif "embed" in panel_data:
            await inter.edit_original_message(content=None, **panel_data)
        else:
            await inter.edit_original_message(
                **panel_data,
                flags=disnake.MessageFlags(is_components_v2=True),
            )


def setup(bot: commands.Bot):
    bot.add_cog(Loja(bot))
