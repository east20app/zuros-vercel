"""
Painel de preferências da loja.

O layout reproduz o painel de Preferências mostrado nas referências e mantém
os fluxos de carregamento das configurações existentes.
"""

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message


class PreferenciasLoja(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def _safe_emoji(alias: str, fallback):
        """Preserva o emoji customizado e usa um fallback se o alias não existir."""
        return getattr(emoji, alias, fallback)

    @staticmethod
    def _options() -> list:
        """Opções exibidas no menu expandido, na mesma ordem da referência."""
        return [
            disnake.SelectOption(
                label="Alterar Estilo Carrinho",
                value="cart",
                emoji=PreferenciasLoja._safe_emoji("cart", "🛒"),
                description="Configure o estilo do carrinho de compras, atualmente: Canal",
            ),
            disnake.SelectOption(
                label="Botão Dúvidas",
                value="doubt_button",
                emoji=PreferenciasLoja._safe_emoji(
                    "link", PreferenciasLoja._safe_emoji("interrogation", "🔗")
                ),
                description="Configure o botão de dúvidas",
            ),
            disnake.SelectOption(
                label="Termos de Compra",
                value="terms",
                emoji=PreferenciasLoja._safe_emoji(
                    "hash", PreferenciasLoja._safe_emoji("receipt", "#️⃣")
                ),
                description="Configure os termos de compra",
            ),
            disnake.SelectOption(
                label="Gerenciar BlackList",
                value="blacklist",
                emoji=PreferenciasLoja._safe_emoji(
                    "ghost", PreferenciasLoja._safe_emoji("settings2", "👻")
                ),
                description="Gerencie usuários bloqueados",
            ),
            disnake.SelectOption(
                label="Sistema solicitar estoque",
                value="stock_requests",
                emoji=PreferenciasLoja._safe_emoji("cardbox", "📦"),
                description="Edite e publique o painel de solicitação de estoque",
            ),
        ]

    @staticmethod
    def panel(inter: disnake.MessageInteraction) -> dict:
        mode = (db.get_document("custom_mode") or {}).get("mode")
        return (
            PreferenciasLoja._panel_embed(inter)
            if mode == "embed"
            else PreferenciasLoja._panel_components(inter)
        )

    @staticmethod
    def _panel_components(inter: disnake.MessageInteraction) -> dict:
        colors = db.get_document("custom_colors") or {}
        primary_color_hex = colors.get("primary")
        container_kwargs = {}
        if primary_color_hex:
            container_kwargs["accent_colour"] = disnake.Colour(
                int(primary_color_hex.replace("#", ""), 16)
            )

        return {
            "components": [
                disnake.ui.Container(
                    disnake.ui.TextDisplay(
                        f"# {emoji.zuros}\n-# Painel > Loja > **Preferências**"
                    ),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(
                        "Gerencie as preferências globais da sua loja."
                    ),
                    disnake.ui.Separator(),
                    disnake.ui.ActionRow(
                        disnake.ui.StringSelect(
                            custom_id="Loja_Preferencias_Select",
                            placeholder="Selecione uma configuração",
                            options=PreferenciasLoja._options(),
                        )
                    ),
                    **container_kwargs,
                ),
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Voltar",
                        style=disnake.ButtonStyle.grey,
                        emoji=emoji.back,
                        custom_id="Painel_Loja",
                    )
                ),
            ]
        }

    @staticmethod
    def _panel_embed(inter: disnake.MessageInteraction) -> dict:
        colors = db.get_document("custom_colors") or {}
        primary_color_hex = colors.get("primary")

        embed_kwargs = {}
        if primary_color_hex:
            embed_kwargs["color"] = int(primary_color_hex.replace("#", ""), 16)

        embed = disnake.Embed(
            description=(
                "-# Painel > Loja > **Preferências**\n\n"
                "Gerencie as preferências globais da sua loja."
            ),
            **embed_kwargs,
        )

        return {
            "embed": embed,
            "components": [
                disnake.ui.ActionRow(
                    disnake.ui.StringSelect(
                        custom_id="Loja_Preferencias_Select",
                        placeholder="Selecione uma configuração",
                        options=PreferenciasLoja._options(),
                    )
                ),
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Voltar",
                        style=disnake.ButtonStyle.grey,
                        emoji=emoji.back,
                        custom_id="Painel_Loja",
                    )
                ),
            ],
        }

    @staticmethod
    def _load_blacklist_panel(inter: disnake.MessageInteraction):
        """Carrega o módulo de blacklist se ele existir no projeto."""
        try:
            from .blacklist import BlacklistPreferences

            return BlacklistPreferences.panel(inter)
        except ImportError:
            try:
                from .black_list import BlackListPreferences

                return BlackListPreferences.panel(inter)
            except ImportError as exc:
                raise RuntimeError(
                    "O módulo de gerenciamento de BlackList ainda não foi incluído no projeto."
                ) from exc

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        if inter.component.custom_id != "Loja_Preferencias":
            return

        mode = (db.get_document("custom_mode") or {}).get("mode")
        await (embed_message if mode == "embed" else message).wait(inter, send=False)
        panel = PreferenciasLoja.panel(inter)

        if mode == "embed":
            await inter.edit_original_message(content=None, **panel)
        else:
            await inter.edit_original_message(
                **panel, flags=disnake.MessageFlags(is_components_v2=True)
            )

    @commands.Cog.listener("on_dropdown")
    async def on_dropdown(self, inter: disnake.MessageInteraction):
        if inter.component.custom_id != "Loja_Preferencias_Select":
            return

        value = inter.values[0]
        mode = (db.get_document("custom_mode") or {}).get("mode")
        await inter.response.defer()

        try:
            if value == "cart":
                from .temp_cart import CartPreferences

                panel = CartPreferences.panel(inter)
            elif value == "doubt_button":
                from .doubt_button import DoubtButtonSystem

                panel = DoubtButtonSystem.panel_doubt_button(inter)
            elif value == "terms":
                from .terms import TermsPreferences

                panel = TermsPreferences.panel(inter)
            elif value == "blacklist":
                panel = PreferenciasLoja._load_blacklist_panel(inter)
            elif value == "stock_requests":
                from .solicitar_estoque import StockRequestPreferences

                panel = StockRequestPreferences.panel(inter)
            else:
                panel = PreferenciasLoja.panel(inter)

            if "embed" in panel:
                await inter.edit_original_message(content=None, **panel)
            elif "components" in panel:
                await inter.edit_original_message(
                    **panel, flags=disnake.MessageFlags(is_components_v2=True)
                )
            else:
                await inter.edit_original_message(**panel)

        except Exception as exc:
            fallback = PreferenciasLoja.panel(inter)
            if "embed" in fallback:
                await inter.edit_original_message(content=None, **fallback)
            else:
                await inter.edit_original_message(
                    **fallback, flags=disnake.MessageFlags(is_components_v2=True)
                )
            await inter.followup.send(
                f"{emoji.wrong} Não foi possível abrir esta configuração: {exc}",
                ephemeral=True,
            )


def setup(bot: commands.Bot):
    bot.add_cog(PreferenciasLoja(bot))
