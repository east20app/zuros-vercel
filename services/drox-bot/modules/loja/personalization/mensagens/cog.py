"""
Sistema de personalização de mensagens da loja.

O botão principal não abre mais um modal diretamente.
Agora ele abre um subpainel com as opções de formato da mensagem:
- Components V2
- Painel normal (Embed)
- Mensagem normal

O modal fica apenas na opção específica "Cor e imagem", pois HEX e URL
precisam de entrada de texto.
"""

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message


class PersonalizarMensagens(commands.Cog):
    """Painel de personalização das mensagens automáticas da loja."""

    COMPONENT_MODES = {"components", "component", "components_v2", "component_v2", "v2"}
    EMBED_MODES = {"embed", "panel", "painel"}
    MESSAGE_MODES = {"message", "mensagem", "normal", "text", "texto"}

    EVENT_MODE_ALIASES = {
        "components": "components",
        "component": "components",
        "components_v2": "components",
        "component_v2": "components",
        "v2": "components",
        "embed": "embed",
        "panel": "embed",
        "painel": "embed",
        "message": "message",
        "mensagem": "message",
        "normal": "message",
        "text": "message",
        "texto": "message",
        "image": "image",
        "imagem": "image",
        "preview": "image",
        "card": "image",
    }

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_mode() -> str:
        """Normaliza o modo visual do painel administrativo."""
        custom_mode = db.get_document("custom_mode") or {}
        raw_mode = str(custom_mode.get("mode", "components")).strip().lower()

        if raw_mode in PersonalizarMensagens.EMBED_MODES:
            return "embed"
        if raw_mode in PersonalizarMensagens.MESSAGE_MODES:
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
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _get_configs():
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}
        feedback_config = config.get("feedback_incentive") or {}

        event_configured = bool(
            str(event_config.get("color", "")).strip()
            or str(event_config.get("image", "")).strip()
            or str(event_config.get("mode", "")).strip()
        )
        feedback_configured = bool(str(feedback_config.get("message", "")).strip())

        return event_config, feedback_config, event_configured, feedback_configured

    @staticmethod
    def _status_icon(enabled: bool):
        return emoji.on if enabled else emoji.off

    @staticmethod
    def _event_mode() -> str:
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}
        raw_mode = str(event_config.get("mode", "components")).strip().lower()
        return PersonalizarMensagens.EVENT_MODE_ALIASES.get(raw_mode, "components")

    @staticmethod
    def _event_mode_label(mode: str) -> str:
        return {
            "components": "Components V2",
            "embed": "Painel normal",
            "message": "Mensagem normal",
            "image": "Imagem automática",
        }.get(mode, "Components V2")

    @staticmethod
    def _save_event_mode(mode: str):
        normalized = PersonalizarMensagens.EVENT_MODE_ALIASES.get(mode, "components")
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}
        event_config["mode"] = normalized
        config["purchase_event"] = event_config
        db.save_document("loja_personalization", config)

    @staticmethod
    def _mode_button_style(button_mode: str, selected_mode: str):
        return (
            disnake.ButtonStyle.green
            if button_mode == selected_mode
            else disnake.ButtonStyle.grey
        )

    @staticmethod
    def _main_buttons():
        return [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Evento de Compra",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.sparkles,
                    custom_id="Loja_Personalizar_EventoCompra",
                ),
                disnake.ui.Button(
                    label="Incentivo de Feedback",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.star,
                    custom_id="Loja_Personalizar_Feedback",
                ),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Loja_Personalizar",
                )
            ),
        ]

    @staticmethod
    def _event_buttons():
        selected_mode = PersonalizarMensagens._event_mode()

        return [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Components V2",
                    style=PersonalizarMensagens._mode_button_style("components", selected_mode),
                    custom_id="Loja_Evento_Modo_Components",
                ),
                disnake.ui.Button(
                    label="Painel normal",
                    style=PersonalizarMensagens._mode_button_style("embed", selected_mode),
                    custom_id="Loja_Evento_Modo_Embed",
                ),
                disnake.ui.Button(
                    label="Mensagem normal",
                    style=PersonalizarMensagens._mode_button_style("message", selected_mode),
                    custom_id="Loja_Evento_Modo_Message",
                ),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Imagem automática",
                    style=PersonalizarMensagens._mode_button_style("image", selected_mode),
                    emoji="🖼️",
                    custom_id="Loja_Evento_Modo_Image",
                ),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Cor e imagem manual",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.sparkles,
                    custom_id="Loja_Evento_Aparencia",
                ),
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Loja_Evento_Voltar",
                ),
            ),
        ]

    @staticmethod
    def _feedback_buttons():
        return [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Editar texto e botão",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.star,
                    custom_id="Loja_Feedback_EditarTexto",
                ),
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Loja_Feedback_Voltar",
                ),
            )
        ]

    @staticmethod
    async def _wait_for_panel(inter, *, send=None):
        mode = PersonalizarMensagens._get_mode()
        waiter = embed_message if mode == "embed" else message

        if send is None:
            await waiter.wait(inter)
        else:
            await waiter.wait(inter, send=send)

    # ------------------------------------------------------------------
    # Painel principal
    # ------------------------------------------------------------------

    @staticmethod
    def panel(inter) -> dict:
        mode = PersonalizarMensagens._get_mode()
        if mode == "embed":
            return PersonalizarMensagens._panel_embed(inter)
        if mode == "message":
            return PersonalizarMensagens._panel_message(inter)
        return PersonalizarMensagens._panel_components_v2(inter)

    @staticmethod
    def _panel_components_v2(inter) -> dict:
        color = PersonalizarMensagens._get_primary_color()
        event_config, feedback_config, event_ok, feedback_ok = PersonalizarMensagens._get_configs()
        event_mode = PersonalizarMensagens._event_mode()

        container_kwargs = {}
        if color:
            container_kwargs["accent_colour"] = color

        event_color = str(event_config.get("color", "")).strip() or "Padrão"
        event_image = "Configurada" if str(event_config.get("image", "")).strip() else "Não configurada"
        feedback_button = str(feedback_config.get("button_text", "")).strip() or "Deixar Avaliação"

        components = [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros} Central de Mensagens\n"
                    "-# Loja  ›  Personalização  ›  Mensagens"
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(
                    "Configure o formato e o visual das mensagens automáticas da loja."
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(
                    f"## {emoji.sparkles} Evento de Compra\n"
                    f"{PersonalizarMensagens._status_icon(event_ok)} "
                    f"**{PersonalizarMensagens._event_mode_label(event_mode)}**\n"
                    "-# Mensagem pública enviada quando uma compra é concluída.\n"
                    f"-# Cor: `{event_color}`  •  Imagem: **{event_image}**"
                ),
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Configurar Evento",
                        style=disnake.ButtonStyle.blurple,
                        emoji=emoji.sparkles,
                        custom_id="Loja_Personalizar_EventoCompra",
                    )
                ),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(
                    f"## {emoji.star} Pós-venda & Feedback\n"
                    f"{PersonalizarMensagens._status_icon(feedback_ok)} "
                    f"**{'Configurado' if feedback_ok else 'Não configurado'}**\n"
                    "-# Mensagem usada para incentivar uma avaliação.\n"
                    f"-# Botão atual: **{feedback_button}**"
                ),
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Configurar Feedback",
                        style=disnake.ButtonStyle.blurple,
                        emoji=emoji.star,
                        custom_id="Loja_Personalizar_Feedback",
                    )
                ),
                **container_kwargs,
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Loja_Personalizar",
                )
            ),
        ]

        return {"content": None, "embed": None, "components": components}

    _panel_components = _panel_components_v2

    @staticmethod
    def _panel_embed(inter) -> dict:
        color = PersonalizarMensagens._get_primary_color()
        event_config, feedback_config, event_ok, feedback_ok = PersonalizarMensagens._get_configs()
        event_mode = PersonalizarMensagens._event_mode()

        embed = disnake.Embed(
            title="Central de Mensagens",
            description=(
                "-# Loja › Personalização › Mensagens\n\n"
                "Configure os avisos automáticos usados durante e após as compras."
            ),
            color=color or disnake.Colour.blurple(),
        )

        event_color = str(event_config.get("color", "")).strip() or "Padrão"
        event_image = "Sim" if str(event_config.get("image", "")).strip() else "Não"

        embed.add_field(
            name=f"{emoji.sparkles} Evento de Compra",
            value=(
                f"{PersonalizarMensagens._status_icon(event_ok)} "
                f"**{PersonalizarMensagens._event_mode_label(event_mode)}**\n"
                f"`Cor:` {event_color}\n"
                f"`Imagem:` {event_image}"
            ),
            inline=False,
        )

        feedback_button = str(feedback_config.get("button_text", "")).strip() or "Deixar Avaliação"
        embed.add_field(
            name=f"{emoji.star} Incentivo de Feedback",
            value=(
                f"{PersonalizarMensagens._status_icon(feedback_ok)} "
                f"**{'Configurado' if feedback_ok else 'Não configurado'}**\n"
                f"`Botão:` {feedback_button}"
            ),
            inline=False,
        )

        return {"content": None, "embed": embed, "components": PersonalizarMensagens._main_buttons()}

    @staticmethod
    def _panel_message(inter) -> dict:
        event_config, feedback_config, event_ok, feedback_ok = PersonalizarMensagens._get_configs()
        event_mode = PersonalizarMensagens._event_mode()

        event_color = str(event_config.get("color", "")).strip() or "Padrão"
        has_image = bool(str(event_config.get("image", "")).strip())
        feedback_button = str(feedback_config.get("button_text", "")).strip() or "Deixar Avaliação"

        content = (
            f"## {emoji.zuros} Central de Mensagens\n"
            "-# Loja › Personalização › Mensagens\n\n"
            f"### {emoji.sparkles} Evento de Compra\n"
            f"{PersonalizarMensagens._status_icon(event_ok)} "
            f"**{PersonalizarMensagens._event_mode_label(event_mode)}**\n"
            f"> Cor: `{event_color}`\n"
            f"> Imagem: **{'Configurada' if has_image else 'Não configurada'}**\n\n"
            f"### {emoji.star} Incentivo de Feedback\n"
            f"{PersonalizarMensagens._status_icon(feedback_ok)} "
            f"**{'Configurado' if feedback_ok else 'Não configurado'}**\n"
            f"> Botão: **{feedback_button}**"
        )

        return {"content": content, "embed": None, "components": PersonalizarMensagens._main_buttons()}

    # ------------------------------------------------------------------
    # Subpainel: evento de compra
    # ------------------------------------------------------------------

    @staticmethod
    def event_panel(inter) -> dict:
        mode = PersonalizarMensagens._get_mode()
        if mode == "embed":
            return PersonalizarMensagens._event_panel_embed(inter)
        if mode == "message":
            return PersonalizarMensagens._event_panel_message(inter)
        return PersonalizarMensagens._event_panel_components(inter)

    @staticmethod
    def _event_panel_components(inter) -> dict:
        color = PersonalizarMensagens._get_primary_color()
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}
        selected_mode = PersonalizarMensagens._event_mode()

        event_color = str(event_config.get("color", "")).strip() or "Cor padrão da loja"
        event_image = "Configurada" if str(event_config.get("image", "")).strip() else "Sem imagem"

        container_kwargs = {"accent_colour": color} if color else {}
        event_buttons = PersonalizarMensagens._event_buttons()
        mode_buttons = event_buttons[:2]
        edit_buttons = event_buttons[2]

        return {
            "content": None,
            "embed": None,
            "components": [
                disnake.ui.Container(
                    disnake.ui.TextDisplay(
                        f"# {emoji.sparkles} Evento de Compra\n"
                        "-# Escolha como a mensagem pública será exibida"
                    ),
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(
                        "## Formato da mensagem\n"
                        f"Atual: **{PersonalizarMensagens._event_mode_label(selected_mode)}**\n\n"
                        "Selecione uma das quatro opções abaixo. A alteração é salva na hora.\n"
                        "-# Imagem automática gera o card de compra no momento do envio."
                    ),
                    *mode_buttons,
                    disnake.ui.Separator(),
                    disnake.ui.TextDisplay(
                        "## Aparência\n"
                        f"**Cor:** `{event_color}`\n"
                        f"**Imagem:** {event_image}\n"
                        "-# Cor e imagem são opcionais."
                    ),
                    edit_buttons,
                    **container_kwargs,
                )
            ],
        }

    @staticmethod
    def _event_panel_embed(inter) -> dict:
        color = PersonalizarMensagens._get_primary_color()
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}
        selected_mode = PersonalizarMensagens._event_mode()

        event_color = str(event_config.get("color", "")).strip() or "Cor padrão da loja"
        event_image = "Configurada" if str(event_config.get("image", "")).strip() else "Sem imagem"

        embed = disnake.Embed(
            title="Evento de Compra",
            description=(
                "Escolha como a mensagem pública de compra será enviada.\n\n"
                f"**Formato atual:** {PersonalizarMensagens._event_mode_label(selected_mode)}\n"
                f"**Cor:** `{event_color}`\n"
                f"**Imagem:** {event_image}"
            ),
            color=color or disnake.Colour.blurple(),
        )

        return {"content": None, "embed": embed, "components": PersonalizarMensagens._event_buttons()}

    @staticmethod
    def _event_panel_message(inter) -> dict:
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}
        selected_mode = PersonalizarMensagens._event_mode()

        event_color = str(event_config.get("color", "")).strip() or "Cor padrão da loja"
        event_image = "Configurada" if str(event_config.get("image", "")).strip() else "Sem imagem"

        content = (
            f"## {emoji.sparkles} Evento de Compra\n"
            "Escolha como a mensagem pública será exibida.\n\n"
            f"**Formato atual:** {PersonalizarMensagens._event_mode_label(selected_mode)}\n"
            f"**Cor:** `{event_color}`\n"
            f"**Imagem:** {event_image}"
        )

        return {"content": content, "embed": None, "components": PersonalizarMensagens._event_buttons()}

    # ------------------------------------------------------------------
    # Subpainel: feedback
    # ------------------------------------------------------------------

    @staticmethod
    def feedback_panel(inter) -> dict:
        mode = PersonalizarMensagens._get_mode()
        config = db.get_document("loja_personalization") or {}
        feedback_config = config.get("feedback_incentive") or {}

        current_message = str(feedback_config.get("message", "")).strip() or "Mensagem padrão"
        current_button = str(feedback_config.get("button_text", "")).strip() or "Deixar Avaliação"
        preview = current_message[:350] + ("..." if len(current_message) > 350 else "")

        if mode == "components":
            color = PersonalizarMensagens._get_primary_color()
            kwargs = {"accent_colour": color} if color else {}
            return {
                "content": None,
                "embed": None,
                "components": [
                    disnake.ui.Container(
                        disnake.ui.TextDisplay(
                            f"# {emoji.star} Pós-venda & Feedback\n"
                            "-# Personalize a mensagem enviada ao cliente"
                        ),
                        disnake.ui.Separator(),
                        disnake.ui.TextDisplay(
                            f"**Texto atual**\n{preview}\n\n"
                            f"**Botão:** `{current_button}`"
                        ),
                        *PersonalizarMensagens._feedback_buttons(),
                        **kwargs,
                    )
                ],
            }

        if mode == "embed":
            embed = disnake.Embed(
                title="Pós-venda & Feedback",
                description=f"**Texto atual**\n{preview}\n\n**Botão:** `{current_button}`",
                color=PersonalizarMensagens._get_primary_color() or disnake.Colour.blurple(),
            )
            return {"content": None, "embed": embed, "components": PersonalizarMensagens._feedback_buttons()}

        return {
            "content": (
                f"## {emoji.star} Pós-venda & Feedback\n"
                f"**Texto atual**\n{preview}\n\n"
                f"**Botão:** `{current_button}`"
            ),
            "embed": None,
            "components": PersonalizarMensagens._feedback_buttons(),
        }

    # ------------------------------------------------------------------
    # Eventos de botão
    # ------------------------------------------------------------------

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        custom_id = getattr(inter.component, "custom_id", None)

        if custom_id == "Loja_Personalizar_Mensagens":
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.panel(inter))
            return

        # Agora abre o SUBPAINEL, não o modal.
        if custom_id == "Loja_Personalizar_EventoCompra":
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.event_panel(inter))
            return

        if custom_id == "Loja_Evento_Modo_Components":
            self._save_event_mode("components")
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.event_panel(inter))
            return

        if custom_id == "Loja_Evento_Modo_Embed":
            self._save_event_mode("embed")
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.event_panel(inter))
            return

        if custom_id == "Loja_Evento_Modo_Message":
            self._save_event_mode("message")
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.event_panel(inter))
            return

        if custom_id == "Loja_Evento_Modo_Image":
            self._save_event_mode("image")
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.event_panel(inter))
            return

        # Modal somente quando o usuário pedir explicitamente para editar HEX/URL.
        if custom_id == "Loja_Evento_Aparencia":
            await inter.response.send_modal(ConfigurarEventoCompraModal())
            return

        if custom_id == "Loja_Evento_Voltar":
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.panel(inter))
            return

        # Feedback também abre um subpainel antes do modal.
        if custom_id == "Loja_Personalizar_Feedback":
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.feedback_panel(inter))
            return

        if custom_id == "Loja_Feedback_EditarTexto":
            await inter.response.send_modal(ConfigurarFeedbackModal())
            return

        if custom_id == "Loja_Feedback_Voltar":
            await self._wait_for_panel(inter, send=False)
            await inter.edit_original_message(**self.panel(inter))
            return


class ConfigurarEventoCompraModal(disnake.ui.Modal):
    """Edita apenas cor e imagem; o formato é escolhido no subpainel."""

    def __init__(self):
        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}

        current_color = str(event_config.get("color", "") or "")
        current_image = str(event_config.get("image", "") or "")

        components = [
            disnake.ui.TextInput(
                label="Cor do evento",
                placeholder="#5865F2 — deixe vazio para usar a cor padrão",
                custom_id="color",
                style=disnake.TextInputStyle.short,
                value=current_color,
                required=False,
                max_length=7,
            ),
            disnake.ui.TextInput(
                label="Imagem do evento",
                placeholder="https://... — deixe vazio para não usar imagem",
                custom_id="image",
                style=disnake.TextInputStyle.short,
                value=current_image,
                required=False,
            ),
        ]

        super().__init__(
            title="Cor e imagem do evento",
            custom_id="ConfigurarEventoCompra_Modal",
            components=components,
        )

    async def callback(self, inter: disnake.ModalInteraction):
        color = inter.text_values.get("color", "").strip()
        image = inter.text_values.get("image", "").strip()

        if color:
            normalized = color[1:] if color.startswith("#") else color
            if len(normalized) != 6:
                await inter.response.send_message(
                    "A cor precisa estar no formato `#RRGGBB`, por exemplo `#5865F2`.",
                    ephemeral=True,
                )
                return

            try:
                int(normalized, 16)
            except ValueError:
                await inter.response.send_message(
                    "A cor informada não é um HEX válido. Exemplo: `#5865F2`.",
                    ephemeral=True,
                )
                return

            color = f"#{normalized.upper()}"

        await PersonalizarMensagens._wait_for_panel(inter)

        config = db.get_document("loja_personalization") or {}
        event_config = config.get("purchase_event") or {}

        # Preserva o formato selecionado no subpainel.
        event_config["mode"] = PersonalizarMensagens.EVENT_MODE_ALIASES.get(
            str(event_config.get("mode", "components")).strip().lower(),
            "components",
        )
        event_config["color"] = color
        event_config["image"] = image

        config["purchase_event"] = event_config
        db.save_document("loja_personalization", config)

        await inter.edit_original_message(**PersonalizarMensagens.event_panel(inter))


class ConfigurarFeedbackModal(disnake.ui.Modal):
    """Edita o texto e o botão do incentivo de feedback."""

    def __init__(self):
        config = db.get_document("loja_personalization") or {}
        feedback_config = config.get("feedback_incentive") or {}

        current_message = feedback_config.get(
            "message",
            "**Obrigado pela sua compra!** 🎉\n\n"
            "Conta pra gente como foi sua experiência.\n"
            "-# Sua avaliação ajuda a loja a continuar melhorando.",
        )
        current_button_text = feedback_config.get("button_text", "Deixar Avaliação")

        components = [
            disnake.ui.TextInput(
                label="Mensagem de pós-venda",
                placeholder="Escreva a mensagem que o cliente receberá",
                custom_id="message",
                style=disnake.TextInputStyle.paragraph,
                value=current_message,
                required=True,
                max_length=1000,
            ),
            disnake.ui.TextInput(
                label="Texto do botão",
                placeholder="Ex: Avaliar compra",
                custom_id="button_text",
                style=disnake.TextInputStyle.short,
                value=current_button_text,
                required=True,
                max_length=30,
            ),
        ]

        super().__init__(
            title="Personalizar Feedback",
            custom_id="ConfigurarFeedback_Modal",
            components=components,
        )

    async def callback(self, inter: disnake.ModalInteraction):
        await PersonalizarMensagens._wait_for_panel(inter)

        config = db.get_document("loja_personalization") or {}
        config["feedback_incentive"] = {
            "message": inter.text_values.get("message", "").strip(),
            "button_text": inter.text_values.get("button_text", "").strip(),
        }
        db.save_document("loja_personalization", config)

        await inter.edit_original_message(**PersonalizarMensagens.feedback_panel(inter))


def setup(bot: commands.Bot):
    bot.add_cog(PersonalizarMensagens(bot))
