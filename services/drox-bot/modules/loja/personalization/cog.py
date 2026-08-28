"""
Painel de personalização da loja.

Compatível com três formatos de exibição:
- Components V2
- Painel normal (Embed)
- Mensagem normal
"""

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message


class PersonalizarLoja(commands.Cog):
    """Painel principal de personalização da loja."""

    COMPONENT_MODES = {"components", "component", "components_v2", "component_v2", "v2"}
    EMBED_MODES = {"embed", "panel", "painel"}
    MESSAGE_MODES = {"message", "mensagem", "normal", "text", "texto"}

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _get_mode() -> str:
        data = db.get_document("custom_mode") or {}
        raw_mode = str(data.get("mode", "components") or "components").strip().lower()

        if raw_mode in PersonalizarLoja.EMBED_MODES:
            return "embed"
        if raw_mode in PersonalizarLoja.MESSAGE_MODES:
            return "message"
        return "components"

    @staticmethod
    def _get_primary_color():
        colors = db.get_document("custom_colors") or {}
        primary_color_hex = colors.get("primary")

        if not primary_color_hex:
            return None

        try:
            return disnake.Colour(int(str(primary_color_hex).replace("#", ""), 16))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _button_emoji(alias: str, fallback: str):
        return getattr(emoji, alias, fallback)

    @staticmethod
    def _description_text() -> str:
        return (
            "### Personalização da loja\n"
            "Escolha abaixo qual parte das mensagens você deseja configurar.\n\n"
            "**Mensagem de Compra**\n"
            "-# Personalize o evento público de compra, incluindo Components V2, painel normal, mensagem normal ou imagem automática.\n\n"
            "**Mensagem de Compra Aprovada**\n"
            "-# Configure o conteúdo enviado ao cliente quando o pagamento for aprovado.\n\n"
            "**Mensagem de Primeira Compra**\n"
            "-# Defina uma mensagem especial para quem realiza a primeira compra.\n\n"
            "**Mensagem Após Compra**\n"
            "-# Configure o lembrete enviado após a compra, como pedido de feedback."
        )

    @staticmethod
    def _message_buttons() -> list:
        return [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Mensagem de Compra",
                    style=disnake.ButtonStyle.grey,
                    emoji=PersonalizarLoja._button_emoji("reload", "↻"),
                    custom_id="Loja_Personalizar_Mensagens",
                ),
                disnake.ui.Button(
                    label="Compra Aprovada",
                    style=disnake.ButtonStyle.grey,
                    emoji=PersonalizarLoja._button_emoji("edit", "✎"),
                    custom_id="Loja_Personalizar_MensagemAprovada",
                ),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Primeira Compra",
                    style=disnake.ButtonStyle.grey,
                    emoji=PersonalizarLoja._button_emoji("fire", "♨"),
                    custom_id="Loja_Personalizar_PrimeiraCompra",
                ),
                disnake.ui.Button(
                    label="Após Compra",
                    style=disnake.ButtonStyle.grey,
                    emoji=PersonalizarLoja._button_emoji("lightning", "⚡"),
                    custom_id="Loja_Personalizar_AposCompra",
                ),
            ),
        ]

    @staticmethod
    def _back_button() -> disnake.ui.ActionRow:
        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Voltar",
                style=disnake.ButtonStyle.grey,
                emoji=getattr(emoji, "back", "⬅️"),
                custom_id="Painel_Loja",
            )
        )

    # ------------------------------------------------------------------
    # Painel principal
    # ------------------------------------------------------------------
    @staticmethod
    def panel(inter: disnake.MessageInteraction) -> dict:
        mode = PersonalizarLoja._get_mode()

        if mode == "embed":
            return PersonalizarLoja._panel_embed(inter)
        if mode == "message":
            return PersonalizarLoja._panel_message(inter)
        return PersonalizarLoja._panel_components(inter)

    @staticmethod
    def _panel_components(inter: disnake.MessageInteraction) -> dict:
        """Painel usando Components V2."""
        color = PersonalizarLoja._get_primary_color()
        container_kwargs = {"accent_colour": color} if color else {}

        container = disnake.ui.Container(
            disnake.ui.TextDisplay(
                f"# {getattr(emoji, 'zuros', '🛍️')} Personalizar Loja\n"
                "-# Painel > Loja > Personalizar"
            ),
            disnake.ui.Separator(),
            disnake.ui.TextDisplay(PersonalizarLoja._description_text()),
            disnake.ui.Separator(),
            *PersonalizarLoja._message_buttons(),
            **container_kwargs,
        )

        return {
            "components": [
                container,
                PersonalizarLoja._back_button(),
            ]
        }

    @staticmethod
    def _panel_embed(inter: disnake.MessageInteraction) -> dict:
        """Painel usando Embed tradicional."""
        color = PersonalizarLoja._get_primary_color()

        embed = disnake.Embed(
            title="Personalizar Loja",
            description=(
                "-# Painel > Loja > Personalizar\n\n"
                f"{PersonalizarLoja._description_text()}"
            ),
            color=color or disnake.Color.blurple(),
        )

        return {
            "embed": embed,
            "content": None,
            "components": [
                *PersonalizarLoja._message_buttons(),
                PersonalizarLoja._back_button(),
            ],
        }

    @staticmethod
    def _panel_message(inter: disnake.MessageInteraction) -> dict:
        """Painel como mensagem normal com botões tradicionais."""
        content = (
            f"## {getattr(emoji, 'zuros', '🛍️')} Personalizar Loja\n"
            "-# Painel > Loja > Personalizar\n\n"
            f"{PersonalizarLoja._description_text()}"
        )

        return {
            "content": content,
            "embed": None,
            "components": [
                *PersonalizarLoja._message_buttons(),
                PersonalizarLoja._back_button(),
            ],
        }

    # ------------------------------------------------------------------
    # Navegação
    # ------------------------------------------------------------------
    async def _prepare_edit(self, inter: disnake.MessageInteraction):
        mode = self._get_mode()

        if mode == "embed":
            await embed_message.wait(inter, send=False)
        else:
            await message.wait(inter, send=False)

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        custom_id = inter.component.custom_id

        if custom_id == "Loja_Personalizar":
            await self._prepare_edit(inter)
            await inter.edit_original_message(**self.panel(inter))

        elif custom_id == "Loja_Personalizar_DoubtButton":
            from .doubt_button import DoubtButtonSystem

            await self._prepare_edit(inter)
            panel_data = DoubtButtonSystem.panel_doubt_button(inter)
            await inter.edit_original_message(**panel_data)

        elif custom_id == "Loja_Personalizar_QRCode":
            from .qr_customization import QRCodeGenerator

            await self._prepare_edit(inter)
            panel_data = QRCodeGenerator.panel(inter)
            await inter.edit_original_message(**panel_data)

        elif custom_id == "Loja_DoubtButton_Config":
            from .doubt_button import DoubtButtonModal
            await inter.response.send_modal(DoubtButtonModal())

        elif custom_id == "Loja_DoubtButton_Toggle":
            data = db.get_document("loja_doubt_button") or {}
            data["enabled"] = not data.get("enabled", False)
            db.save_document("loja_doubt_button", data)

            from .doubt_button import DoubtButtonSystem

            await self._prepare_edit(inter)
            panel_data = DoubtButtonSystem.panel_doubt_button(inter)
            await inter.edit_original_message(**panel_data)

        elif custom_id == "Loja_QRCode_Config":
            from .qr_customization import QRCustomizationModal
            await inter.response.send_modal(QRCustomizationModal())

        elif custom_id == "Loja_QRCode_Toggle":
            data = db.get_document("loja_qr_customization") or {}
            data["enabled"] = not data.get("enabled", False)
            db.save_document("loja_qr_customization", data)

            from .qr_customization import QRCodeGenerator

            await self._prepare_edit(inter)
            panel_data = QRCodeGenerator.panel(inter)
            await inter.edit_original_message(**panel_data)

        elif custom_id == "Loja_QRCode_Test":
            from .qr_customization import QRCodeGenerator

            await inter.response.defer(ephemeral=True)

            qr_bytes = await QRCodeGenerator.generate_custom_qr(
                "https://api.zurosapplications.com.br"
            )

            if qr_bytes:
                import io

                file = disnake.File(io.BytesIO(qr_bytes), filename="qr_test.png")
                await inter.followup.send(
                    f"{getattr(emoji, 'correct', '✅')} QR Code de teste gerado!",
                    file=file,
                    ephemeral=True,
                )
            else:
                await inter.followup.send(
                    f"{getattr(emoji, 'wrong', '❌')} Erro ao gerar QR Code de teste!",
                    ephemeral=True,
                )

        elif custom_id == "product_doubt_button":
            from .doubt_button import DoubtButtonSystem
            await DoubtButtonSystem.handle_doubt_button(inter)


def setup(bot: commands.Bot):
    bot.add_cog(PersonalizarLoja(bot))
