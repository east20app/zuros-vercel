import re
import logging

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from modules.automations.boas_vindas import helpers


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════

MODOS_VALIDOS = {
    "v1": "Mensagem Padrão",
    "v2": "Componentes V2",
    "embed": "Embed",
}

ROTAS_VALIDAS = {
    "canal": "Canal de boas-vindas",
    "dm": "Mensagem Direta",
    "canal_dm": "Canal + Mensagem Direta",
}

MAX_PREVIEW_MENSAGEM = 350
MAX_TEMPO_SEGUNDOS = 86400


# ═════════════════════════════════════════════════════════════
# COG
# ═════════════════════════════════════════════════════════════

class BoasVindasConfig(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _get_mode() -> str:
        data = (
            db.get_document("custom_mode")
            or {}
        )

        return data.get(
            "mode",
            "components",
        )

    @staticmethod
    def _get_primary_color() -> int | None:
        colors = (
            db.get_document("custom_colors")
            or {}
        )

        primary = colors.get("primary")

        if not primary:
            return None

        try:
            return int(
                str(primary)
                .replace("#", ""),
                16,
            )

        except (TypeError, ValueError):
            return None

    @classmethod
    def _container_kwargs(cls) -> dict:
        color = cls._get_primary_color()

        if color is None:
            return {}

        return {
            "accent_colour": disnake.Colour(
                color
            )
        }

    @classmethod
    def _apply_embed_color(
        cls,
        embed: disnake.Embed,
    ) -> None:
        color = cls._get_primary_color()

        if color is not None:
            embed.color = color

    @staticmethod
    def _get_config() -> dict:
        return helpers.carregar_config() or {}

    @staticmethod
    def _truncate(
        value: str,
        limit: int,
    ) -> str:
        value = str(value or "")

        if len(value) <= limit:
            return value

        return (
            value[:limit - 3]
            + "..."
        )

    @staticmethod
    def _safe_codeblock(
        value: str,
    ) -> str:
        return str(value).replace(
            "```",
            "``\u200b`",
        )

    @classmethod
    def _config_values(
        cls,
    ):
        config = cls._get_config()

        mensagem = str(
            config.get("mensagem")
            or ""
        )

        try:
            tempo = int(
                config.get(
                    "tempo_segundos",
                    0,
                )
                or 0
            )
        except (TypeError, ValueError):
            tempo = 0

        modo = str(
            config.get(
                "modo_envio",
                "v1",
            )
        )

        if modo not in MODOS_VALIDOS:
            modo = "v1"

        rota = str(
            config.get(
                "rota_envio",
                "canal",
            )
        )

        if rota not in ROTAS_VALIDAS:
            rota = "canal"

        ativado = bool(
            config.get(
                "ativado",
                True,
            )
        )

        return (
            config,
            mensagem,
            tempo,
            modo,
            rota,
            ativado,
        )

    @classmethod
    def _build_summary(
        cls,
    ) -> str:
        (
            _,
            mensagem,
            tempo,
            modo,
            rota,
            ativado,
        ) = cls._config_values()

        mensagem_preview = cls._truncate(
            mensagem,
            MAX_PREVIEW_MENSAGEM,
        )

        if not mensagem_preview:
            mensagem_preview = "Não configurada"

        mensagem_preview = cls._safe_codeblock(
            mensagem_preview
        )

        duracao = (
            "Não apagar"
            if tempo <= 0
            else f"{tempo} segundo{'s' if tempo != 1 else ''}"
        )

        return (
            f"{emoji.on if ativado else emoji.off} "
            f"**Status:** "
            f"`{'Ativado' if ativado else 'Desativado'}`\n"

            f"{emoji.clock} "
            f"**Duração:** `{duracao}`\n"

            f"{emoji.reload} "
            f"**Estilo:** `{MODOS_VALIDOS[modo]}`\n"

            f"{emoji.route} "
            f"**Envio:** `{ROTAS_VALIDAS[rota]}`\n\n"

            f"{emoji.edit} **Mensagem atual:**\n"
            f"```text\n{mensagem_preview}\n```"
        )

    @staticmethod
    def _back_button(
        custom_id: str,
    ) -> disnake.ui.ActionRow:
        return disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Voltar",
                style=disnake.ButtonStyle.grey,
                emoji=emoji.back,
                custom_id=custom_id,
            )
        )

    # ═════════════════════════════════════════════════════════
    # BOTÕES PRINCIPAIS
    # ═════════════════════════════════════════════════════════

    @classmethod
    def _main_buttons(
        cls,
    ) -> list[disnake.ui.ActionRow]:
        (
            _,
            mensagem,
            _,
            _,
            _,
            ativado,
        ) = cls._config_values()

        preview_disponivel = bool(
            mensagem.strip()
        )

        return [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label=(
                        "Desativar"
                        if ativado
                        else "Ativar"
                    ),
                    style=(
                        disnake.ButtonStyle.red
                        if ativado
                        else disnake.ButtonStyle.green
                    ),
                    emoji=emoji.power,
                    custom_id="BV_ToggleAtivo",
                ),

                disnake.ui.Button(
                    label="Editar Mensagem",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.edit,
                    custom_id="BV_EditMensagem",
                    disabled=not ativado,
                ),

                disnake.ui.Button(
                    label="Editar Duração",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.clock,
                    custom_id="BV_EditTempo",
                    disabled=not ativado,
                ),
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Prévia",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.search,
                    custom_id="BV_Preview",
                    disabled=(
                        not ativado
                        or not preview_disponivel
                    ),
                ),

                disnake.ui.Button(
                    label="Estilo",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.reload,
                    custom_id="BV_AbrirModo",
                    disabled=not ativado,
                ),

                disnake.ui.Button(
                    label="Local de Envio",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.route,
                    custom_id="BV_AbrirRota",
                    disabled=not ativado,
                ),
            ),
        ]

    # ═════════════════════════════════════════════════════════
    # PAINEL PRINCIPAL
    # ═════════════════════════════════════════════════════════

    @classmethod
    def Painel(
        cls,
    ) -> list[disnake.ui.Container]:

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Automações › **Boas-Vindas**"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Configure a mensagem enviada automaticamente "
                    "quando um novo membro entrar no servidor."
                ),

                disnake.ui.Separator(
                    spacing=disnake.SeparatorSpacing.small
                ),

                disnake.ui.TextDisplay(
                    cls._build_summary()
                ),

                disnake.ui.Separator(
                    spacing=disnake.SeparatorSpacing.small
                ),

                *cls._main_buttons(),

                **cls._container_kwargs(),
            ),

            cls._back_button(
                "VoltarAutomações"
            ),
        ]

    @classmethod
    def PainelEmbed(
        cls,
    ) -> tuple[
        disnake.Embed,
        list[disnake.ui.ActionRow],
    ]:

        embed = disnake.Embed(
            title="Boas-Vindas",
            description=(
                "Configure a mensagem enviada automaticamente "
                "quando um novo membro entrar no servidor."
            ),
        )

        cls._apply_embed_color(
            embed
        )

        embed.add_field(
            name="Configuração Atual",
            value=cls._build_summary(),
            inline=False,
        )

        return (
            embed,
            [
                *cls._main_buttons(),
                cls._back_button(
                    "VoltarAutomações"
                ),
            ],
        )

    # ═════════════════════════════════════════════════════════
    # ROTA
    # ═════════════════════════════════════════════════════════

    @classmethod
    def _route_options(
        cls,
    ) -> list[disnake.SelectOption]:

        config = cls._get_config()

        rota = str(
            config.get(
                "rota_envio",
                "canal",
            )
        )

        return [
            disnake.SelectOption(
                label="Canal",
                value="canal",
                emoji=emoji.textc,
                description=(
                    "Enviar no canal configurado de boas-vindas"
                ),
                default=(
                    rota in {
                        "canal",
                        "canal_dm",
                    }
                ),
            ),

            disnake.SelectOption(
                label="Mensagem Direta",
                value="dm",
                emoji=emoji.message,
                description=(
                    "Enviar diretamente na DM do novo membro"
                ),
                default=(
                    rota in {
                        "dm",
                        "canal_dm",
                    }
                ),
            ),
        ]

    @classmethod
    def PainelSelecionarRota(
        cls,
    ) -> list[disnake.ui.Container]:

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Automações › Boas-Vindas › "
                    "**Local de Envio**"
                ),

                disnake.ui.Separator(
                    spacing=disnake.SeparatorSpacing.small
                ),

                disnake.ui.TextDisplay(
                    "Escolha onde a mensagem de boas-vindas "
                    "deverá ser enviada."
                ),

                disnake.ui.ActionRow(
                    disnake.ui.StringSelect(
                        custom_id="BV_SelectRota",
                        placeholder=(
                            "Selecione Canal, DM ou ambos"
                        ),
                        options=cls._route_options(),
                        min_values=1,
                        max_values=2,
                    )
                ),

                **cls._container_kwargs(),
            ),

            cls._back_button(
                "BV_VoltarPainelBV"
            ),
        ]

    @classmethod
    def PainelSelecionarRotaEmbed(
        cls,
    ):

        embed = disnake.Embed(
            title="Local de Envio",
            description=(
                "Escolha onde a mensagem de boas-vindas "
                "deverá ser enviada."
            ),
        )

        cls._apply_embed_color(
            embed
        )

        components = [
            disnake.ui.ActionRow(
                disnake.ui.StringSelect(
                    custom_id="BV_SelectRota",
                    placeholder=(
                        "Selecione Canal, DM ou ambos"
                    ),
                    options=cls._route_options(),
                    min_values=1,
                    max_values=2,
                )
            ),

            cls._back_button(
                "BV_VoltarPainelBV"
            ),
        ]

        return embed, components

    # ═════════════════════════════════════════════════════════
    # ESTILO
    # ═════════════════════════════════════════════════════════

    @classmethod
    def _mode_options(
        cls,
    ) -> list[disnake.SelectOption]:

        config = cls._get_config()

        modo = str(
            config.get(
                "modo_envio",
                "v1",
            )
        )

        return [
            disnake.SelectOption(
                label="Mensagem Padrão",
                value="v1",
                emoji=emoji.message,
                description=(
                    "Mensagem comum do Discord"
                ),
                default=modo == "v1",
            ),

            disnake.SelectOption(
                label="Componentes V2",
                value="v2",
                emoji=emoji.textc,
                description=(
                    "Mensagem utilizando Components V2"
                ),
                default=modo == "v2",
            ),

            disnake.SelectOption(
                label="Embed",
                value="embed",
                emoji=emoji.embed,
                description=(
                    "Mensagem utilizando embed"
                ),
                default=modo == "embed",
            ),
        ]

    @classmethod
    def PainelSelecionarModo(
        cls,
    ) -> list[disnake.ui.Container]:

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Automações › Boas-Vindas › "
                    "**Estilo da Mensagem**"
                ),

                disnake.ui.Separator(
                    spacing=disnake.SeparatorSpacing.small
                ),

                disnake.ui.TextDisplay(
                    "Escolha o formato utilizado para enviar "
                    "a mensagem de boas-vindas."
                ),

                disnake.ui.ActionRow(
                    disnake.ui.StringSelect(
                        custom_id="BV_SelectModo",
                        placeholder=(
                            "Selecione o estilo da mensagem"
                        ),
                        options=cls._mode_options(),
                        min_values=1,
                        max_values=1,
                    )
                ),

                **cls._container_kwargs(),
            ),

            cls._back_button(
                "BV_VoltarPainelBV"
            ),
        ]

    @classmethod
    def PainelSelecionarModoEmbed(
        cls,
    ):

        embed = disnake.Embed(
            title="Estilo da Mensagem",
            description=(
                "Escolha o formato utilizado para enviar "
                "a mensagem de boas-vindas."
            ),
        )

        cls._apply_embed_color(
            embed
        )

        components = [
            disnake.ui.ActionRow(
                disnake.ui.StringSelect(
                    custom_id="BV_SelectModo",
                    placeholder=(
                        "Selecione o estilo da mensagem"
                    ),
                    options=cls._mode_options(),
                    min_values=1,
                    max_values=1,
                )
            ),

            cls._back_button(
                "BV_VoltarPainelBV"
            ),
        ]

        return embed, components

    # ═════════════════════════════════════════════════════════
    # BOTÕES
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener("on_button_click")
    async def BoasVindas_Button_Listener(
        self,
        inter: disnake.MessageInteraction,
    ):
        custom_id = (
            inter.component.custom_id
            or ""
        )

        if not custom_id.startswith("BV_"):
            return

        # ─────────────────────────────────────────
        # EDITAR MENSAGEM
        # ─────────────────────────────────────────

        if custom_id == "BV_EditMensagem":
            config = self._get_config()

            modo = str(
                config.get(
                    "modo_envio",
                    "v1",
                )
            )

            await inter.response.send_modal(
                EditarMensagemBVModal(
                    modo
                )
            )

            return

        # ─────────────────────────────────────────
        # EDITAR TEMPO
        # ─────────────────────────────────────────

        if custom_id == "BV_EditTempo":
            config = self._get_config()

            try:
                tempo = int(
                    config.get(
                        "tempo_segundos",
                        0,
                    )
                    or 0
                )
            except (TypeError, ValueError):
                tempo = 0

            await inter.response.send_modal(
                EditarTempoBVModal(
                    valor_atual=tempo
                )
            )

            return

        # ─────────────────────────────────────────
        # PRÉVIA
        # ─────────────────────────────────────────

        if custom_id == "BV_Preview":
            await self._handle_preview(
                inter
            )
            return

        # ─────────────────────────────────────────
        # ATIVAR / DESATIVAR
        # ─────────────────────────────────────────

        if custom_id == "BV_ToggleAtivo":
            config = self._get_config()

            novo_status = not bool(
                config.get(
                    "ativado",
                    True,
                )
            )

            helpers.salvar_config({
                "ativado": novo_status
            })

            await self._update_panel(
                inter
            )

            return

        # ─────────────────────────────────────────
        # NAVEGAÇÃO
        # ─────────────────────────────────────────

        if custom_id in {
            "BV_AbrirRota",
            "BV_AbrirModo",
            "BV_VoltarPainelBV",
        }:
            await self._update_panel(
                inter
            )

    # ═════════════════════════════════════════════════════════
    # PRÉVIA
    # ═════════════════════════════════════════════════════════

    async def _handle_preview(
        self,
        inter: disnake.MessageInteraction,
    ):
        config = self._get_config()

        mensagem = str(
            config.get("mensagem")
            or ""
        ).strip()

        if not mensagem:
            await inter.response.send_message(
                f"{emoji.wrong} Configure uma mensagem "
                "antes de visualizar a prévia.",
                ephemeral=True,
            )
            return

        if not inter.guild:
            return

        membro_preview = (
            inter.author
            if isinstance(
                inter.author,
                disnake.Member,
            )
            else inter.guild.me
        )

        conteudo = helpers.formatar_mensagem(
            mensagem,
            membro_preview,
        )

        modo = str(
            config.get(
                "modo_envio",
                "v1",
            )
        )

        try:
            # ─────────────────────────────────────
            # COMPONENTS V2
            # ─────────────────────────────────────

            if modo == "v2":
                await inter.response.send_message(
                    components=[
                        helpers.montar_container_preview(
                            conteudo,
                            config,
                        ),
                        helpers.system_badge_row(),
                    ],
                    flags=disnake.MessageFlags(
                        is_components_v2=True
                    ),
                    ephemeral=True,
                )

                return

            # ─────────────────────────────────────
            # EMBED
            # ─────────────────────────────────────

            if modo == "embed":
                embed = (
                    helpers.montar_embed_preview(
                        conteudo,
                        config,
                    )
                )

                await inter.response.send_message(
                    embed=embed,
                    components=[
                        helpers.system_badge_row()
                    ],
                    ephemeral=True,
                )

                return

            # ─────────────────────────────────────
            # MENSAGEM PADRÃO
            # ─────────────────────────────────────

            kwargs = {
                "content": conteudo,
                "components": [
                    helpers.system_badge_row()
                ],
                "ephemeral": True,
                "allowed_mentions": (
                    disnake.AllowedMentions.none()
                ),
            }

            file = await helpers.baixar_imagem(
                config.get(
                    "v1_imagem_url"
                )
            )

            if file:
                kwargs["file"] = file

            await inter.response.send_message(
                **kwargs
            )

        except Exception:
            logger.exception(
                "Erro ao gerar prévia de boas-vindas."
            )

            if not inter.response.is_done():
                await inter.response.send_message(
                    f"{emoji.wrong} Não foi possível gerar a prévia.",
                    ephemeral=True,
                )

            else:
                try:
                    await inter.followup.send(
                        f"{emoji.wrong} Não foi possível gerar a prévia.",
                        ephemeral=True,
                    )
                except Exception:
                    pass

    # ═════════════════════════════════════════════════════════
    # ATUALIZAR PAINEL
    # ═════════════════════════════════════════════════════════

    async def _update_panel(
        self,
        inter: disnake.Interaction,
    ):
        mode = self._get_mode()

        if mode == "embed":
            await embed_message.wait(
                inter,
                send=False,
            )
        else:
            await message.wait(
                inter,
                send=False,
            )

        custom_id = ""

        if isinstance(
            inter,
            disnake.MessageInteraction,
        ):
            custom_id = (
                inter.component.custom_id
                or ""
            )

        # ─────────────────────────────────────────
        # EMBED
        # ─────────────────────────────────────────

        if mode == "embed":
            if custom_id == "BV_AbrirRota":
                embed, components = (
                    self.PainelSelecionarRotaEmbed()
                )

            elif custom_id == "BV_AbrirModo":
                embed, components = (
                    self.PainelSelecionarModoEmbed()
                )

            else:
                embed, components = (
                    self.PainelEmbed()
                )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

            return

        # ─────────────────────────────────────────
        # COMPONENTS V2
        # ─────────────────────────────────────────

        if custom_id == "BV_AbrirRota":
            components = (
                self.PainelSelecionarRota()
            )

        elif custom_id == "BV_AbrirModo":
            components = (
                self.PainelSelecionarModo()
            )

        else:
            components = self.Painel()

        await inter.edit_original_message(
            content=None,
            components=components,
        )

    # ═════════════════════════════════════════════════════════
    # DROPDOWNS
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener("on_dropdown")
    async def BoasVindas_Dropdown_Listener(
        self,
        inter: disnake.MessageInteraction,
    ):
        custom_id = (
            inter.component.custom_id
            or ""
        )

        if not custom_id.startswith("BV_"):
            return

        # ─────────────────────────────────────────
        # ROTA
        # ─────────────────────────────────────────

        if custom_id == "BV_SelectRota":
            valores = set(
                inter.values
                or []
            )

            if {
                "canal",
                "dm",
            }.issubset(valores):
                rota = "canal_dm"

            elif "dm" in valores:
                rota = "dm"

            else:
                rota = "canal"

            helpers.salvar_config({
                "rota_envio": rota
            })

            await self._update_panel(
                inter
            )

            return

        # ─────────────────────────────────────────
        # ESTILO
        # ─────────────────────────────────────────

        if custom_id == "BV_SelectModo":
            if not inter.values:
                return

            modo = inter.values[0]

            if modo not in MODOS_VALIDOS:
                return

            helpers.salvar_config({
                "modo_envio": modo,
                "usar_componentes_v2": (
                    modo == "v2"
                ),
            })

            await self._update_panel(
                inter
            )


# ═════════════════════════════════════════════════════════════
# MODAL — MENSAGEM
# ═════════════════════════════════════════════════════════════

class EditarMensagemBVModal(disnake.ui.Modal):
    def __init__(
        self,
        modo: str,
    ):
        config = (
            helpers.carregar_config()
            or {}
        )

        modo = str(
            modo
            or config.get(
                "modo_envio",
                "v1",
            )
        )

        if modo not in MODOS_VALIDOS:
            modo = "v1"

        components = [
            disnake.ui.TextInput(
                label="Mensagem de boas-vindas",
                placeholder=(
                    "Use {user}, {nameserver}, "
                    "{nameuser} e {servercount}"
                ),
                value=str(
                    config.get(
                        "mensagem",
                        "",
                    )
                )[:4000],
                custom_id="mensagem",
                style=disnake.TextInputStyle.paragraph,
                max_length=4000,
                required=True,
            )
        ]

        # ─────────────────────────────────────────
        # COMPONENTS V2
        # ─────────────────────────────────────────

        if modo == "v2":
            components.extend([
                disnake.ui.TextInput(
                    label="Imagem URL",
                    placeholder="https://...",
                    value=str(
                        config.get(
                            "v2_imagem_url",
                            "",
                        )
                    )[:4000],
                    custom_id="v2_imagem_url",
                    style=disnake.TextInputStyle.short,
                    required=False,
                ),

                disnake.ui.TextInput(
                    label="Cor do Container",
                    placeholder="#FFFFFF",
                    value=str(
                        config.get(
                            "v2_cor_container",
                            "",
                        )
                    )[:7],
                    custom_id="v2_cor_container",
                    style=disnake.TextInputStyle.short,
                    max_length=7,
                    required=False,
                ),
            ])

            title = "Mensagem — Components V2"

        # ─────────────────────────────────────────
        # EMBED
        # ─────────────────────────────────────────

        elif modo == "embed":
            components.extend([
                disnake.ui.TextInput(
                    label="Título",
                    placeholder="Ex: Bem-vindo(a)!",
                    value=str(
                        config.get(
                            "embed_titulo",
                            "",
                        )
                    )[:256],
                    custom_id="embed_titulo",
                    style=disnake.TextInputStyle.short,
                    max_length=256,
                    required=False,
                ),

                disnake.ui.TextInput(
                    label="Banner URL",
                    placeholder="https://...",
                    value=str(
                        config.get(
                            "embed_banner_url",
                            "",
                        )
                    )[:4000],
                    custom_id="embed_banner_url",
                    style=disnake.TextInputStyle.short,
                    required=False,
                ),

                disnake.ui.TextInput(
                    label="Thumbnail URL",
                    placeholder="https://...",
                    value=str(
                        config.get(
                            "embed_thumb_url",
                            "",
                        )
                    )[:4000],
                    custom_id="embed_thumb_url",
                    style=disnake.TextInputStyle.short,
                    required=False,
                ),

                disnake.ui.TextInput(
                    label="Cor do Embed",
                    placeholder="#FFFFFF",
                    value=str(
                        config.get(
                            "embed_cor",
                            "",
                        )
                    )[:7],
                    custom_id="embed_cor",
                    style=disnake.TextInputStyle.short,
                    max_length=7,
                    required=False,
                ),
            ])

            title = "Mensagem — Embed"

        # ─────────────────────────────────────────
        # PADRÃO
        # ─────────────────────────────────────────

        else:
            components.append(
                disnake.ui.TextInput(
                    label="Imagem URL",
                    placeholder="https://...",
                    value=str(
                        config.get(
                            "v1_imagem_url",
                            "",
                        )
                    )[:4000],
                    custom_id="v1_imagem_url",
                    style=disnake.TextInputStyle.short,
                    required=False,
                )
            )

            title = "Mensagem — Padrão"

        super().__init__(
            title=title,
            custom_id="BV_EditarMensagem_Modal",
            components=components,
        )

    @staticmethod
    def _validar_hex(
        value: str,
    ) -> bool:
        if not value:
            return True

        return bool(
            re.fullmatch(
                r"#[0-9A-Fa-f]{6}",
                value.strip(),
            )
        )

    async def callback(
        self,
        inter: disnake.ModalInteraction,
    ):
        valores = {
            key: (
                value.strip()
                if isinstance(value, str)
                else value
            )
            for key, value
            in inter.text_values.items()
        }

        mensagem = valores.get(
            "mensagem",
            "",
        )

        if not mensagem:
            await inter.response.send_message(
                f"{emoji.wrong} A mensagem de boas-vindas "
                "não pode ficar vazia.",
                ephemeral=True,
            )
            return

        for color_key in (
            "v2_cor_container",
            "embed_cor",
        ):
            color = valores.get(
                color_key
            )

            if (
                color
                and not self._validar_hex(color)
            ):
                await inter.response.send_message(
                    f"{emoji.wrong} A cor deve estar no formato "
                    "`#RRGGBB`. Exemplo: `#5865F2`.",
                    ephemeral=True,
                )
                return

        helpers.salvar_config(
            valores
        )

        cog = inter.bot.get_cog(
            "BoasVindasConfig"
        )

        if cog:
            await cog._update_panel(
                inter
            )


# ═════════════════════════════════════════════════════════════
# MODAL — DURAÇÃO
# ═════════════════════════════════════════════════════════════

class EditarTempoBVModal(disnake.ui.Modal):
    def __init__(
        self,
        valor_atual: int = 0,
    ):
        components = [
            disnake.ui.TextInput(
                label="Duração em segundos",
                placeholder=(
                    "0 = não apagar | Ex: 5, 10, 60"
                ),
                value=str(
                    max(
                        0,
                        int(valor_atual or 0),
                    )
                ),
                custom_id="tempo",
                style=disnake.TextInputStyle.short,
                max_length=5,
                required=True,
            )
        ]

        super().__init__(
            title="Duração da Mensagem",
            custom_id="BV_EditarTempo_Modal",
            components=components,
        )

    async def callback(
        self,
        inter: disnake.ModalInteraction,
    ):
        texto = (
            inter.text_values
            .get("tempo", "0")
            .strip()
        )

        try:
            valor = int(texto)

        except (TypeError, ValueError):
            await inter.response.send_message(
                f"{emoji.wrong} Informe apenas números.\n"
                "Exemplo: `0`, `5`, `10` ou `60`.",
                ephemeral=True,
            )
            return

        if valor < 0:
            await inter.response.send_message(
                f"{emoji.wrong} O tempo não pode ser negativo.",
                ephemeral=True,
            )
            return

        if valor > MAX_TEMPO_SEGUNDOS:
            await inter.response.send_message(
                f"{emoji.wrong} O tempo máximo permitido é "
                f"`{MAX_TEMPO_SEGUNDOS}` segundos.",
                ephemeral=True,
            )
            return

        helpers.salvar_config({
            "tempo_segundos": valor
        })

        cog = inter.bot.get_cog(
            "BoasVindasConfig"
        )

        if cog:
            await cog._update_panel(
                inter
            )


# ═════════════════════════════════════════════════════════════
# SETUP
# ═════════════════════════════════════════════════════════════

def setup(bot: commands.Bot):
    bot.add_cog(
        BoasVindasConfig(bot)
    )