from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import logging

import disnake
from disnake.ext import commands

from functions.database import database as db
from functions.emoji import emoji
from functions.message import message, embed_message

from . import helpers


logger = logging.getLogger(__name__)


TIMEZONE = ZoneInfo("America/Sao_Paulo")

DEFAULT_INTERVAL = 1440
MAX_INTERVAL = 525600  # 1 ano em minutos
MAX_CHANNELS_PREVIEW = 5


class CleanCog(commands.Cog):
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
    def _get_config() -> dict:
        return (
            helpers.carregar_config()
            or {}
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
    def _container_kwargs(
        cls,
    ) -> dict:

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
    def _interval_text(
        minutos,
    ) -> str:

        try:
            minutos = int(minutos)
        except (TypeError, ValueError):
            minutos = DEFAULT_INTERVAL

        if minutos <= 0:
            minutos = DEFAULT_INTERVAL

        if minutos % 1440 == 0:
            dias = minutos // 1440

            return (
                f"A cada {dias} "
                f"dia{'s' if dias != 1 else ''}"
            )

        if minutos % 60 == 0:
            horas = minutos // 60

            return (
                f"A cada {horas}h"
            )

        return (
            f"A cada {minutos}min"
        )

    @staticmethod
    def _next_cleanup_text(
        value,
    ) -> str:

        if not value:
            return "`Aguardando agendamento`"

        try:
            data = datetime.fromisoformat(
                str(value)
            )

            timestamp = int(
                data.timestamp()
            )

            return (
                f"<t:{timestamp}:R>"
            )

        except (
            TypeError,
            ValueError,
            OSError,
        ):
            return "`Agendamento inválido`"

    @classmethod
    def _channels_preview(
        cls,
        config: dict,
    ) -> str:

        canais = (
            config.get("canais")
            or {}
        )

        if not canais:
            return (
                f"{emoji.arrow} "
                "`Nenhum canal configurado`"
            )

        linhas = []

        for canal_id, canal_config in list(
            canais.items()
        )[:MAX_CHANNELS_PREVIEW]:

            if not isinstance(
                canal_config,
                dict,
            ):
                canal_config = {}

            intervalo = cls._interval_text(
                canal_config.get(
                    "intervalo_minutos",
                    DEFAULT_INTERVAL,
                )
            )

            proxima = cls._next_cleanup_text(
                canal_config.get(
                    "proxima_limpeza"
                )
            )

            linhas.append(
                f"{emoji.arrow} <#{canal_id}>\n"
                f"-# {intervalo} • Próxima {proxima}"
            )

        restante = (
            len(canais)
            - MAX_CHANNELS_PREVIEW
        )

        if restante > 0:
            linhas.append(
                f"{emoji.arrow} "
                f"... e mais **{restante}** "
                f"canal{'is' if restante != 1 else ''}"
            )

        return "\n".join(
            linhas
        )

    @classmethod
    def _summary(
        cls,
        config: dict,
    ) -> str:

        ativado = bool(
            config.get(
                "ativado",
                False,
            )
        )

        logs = bool(
            config.get(
                "logs_ativados",
                False,
            )
        )

        canais = (
            config.get("canais")
            or {}
        )

        return (
            f"{emoji.on if ativado else emoji.off} "
            f"**Status:** "
            f"`{'Ativado' if ativado else 'Desativado'}`\n"

            f"{emoji.on if logs else emoji.off} "
            f"**Logs:** "
            f"`{'Ativado' if logs else 'Desativado'}`\n"

            f"{emoji.textc} "
            f"**Canais configurados:** "
            f"`{len(canais)}`"
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

    @classmethod
    def _main_buttons(
        cls,
        config: dict,
    ) -> list[disnake.ui.ActionRow]:

        ativado = bool(
            config.get(
                "ativado",
                False,
            )
        )

        logs = bool(
            config.get(
                "logs_ativados",
                False,
            )
        )

        canais = (
            config.get("canais")
            or {}
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
                    custom_id="Limpeza_ToggleAtivo",
                ),

                disnake.ui.Button(
                    label="Adicionar Canal",
                    style=disnake.ButtonStyle.blurple,
                    emoji=emoji.plus,
                    custom_id=(
                        "Limpeza_AdicionarCanal"
                    ),
                    disabled=not ativado,
                ),

                disnake.ui.Button(
                    label="Remover Canal",
                    style=disnake.ButtonStyle.red,
                    emoji=emoji.minus,
                    custom_id=(
                        "Limpeza_RemoverCanal"
                    ),
                    disabled=(
                        not ativado
                        or not canais
                    ),
                ),
            ),

            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label=(
                        "Desativar Logs"
                        if logs
                        else "Ativar Logs"
                    ),
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.power,
                    custom_id="Limpeza_ToggleLogs",
                    disabled=not ativado,
                ),
            ),
        ]

    def _restart_task(
        self,
    ) -> None:

        task_cog = self.bot.get_cog(
            "CleanTaskCog"
        )

        if not task_cog:
            return

        try:
            task_cog.restart_task()

        except Exception:
            logger.exception(
                "Erro ao reiniciar a task "
                "de limpeza automática."
            )

    # ═════════════════════════════════════════════════════════
    # PAINEL PRINCIPAL
    # ═════════════════════════════════════════════════════════

    @classmethod
    def Painel(
        cls,
    ) -> list:

        config = cls._get_config()

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Automações › "
                    "**Limpeza de Canais**"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Configure canais para terem mensagens "
                    "apagadas automaticamente em intervalos definidos."
                ),

                disnake.ui.Separator(
                    spacing=(
                        disnake.SeparatorSpacing.small
                    )
                ),

                disnake.ui.TextDisplay(
                    cls._summary(
                        config
                    )
                ),

                disnake.ui.Separator(
                    spacing=(
                        disnake.SeparatorSpacing.small
                    )
                ),

                disnake.ui.TextDisplay(
                    "**Canais:**\n"
                    f"{cls._channels_preview(config)}"
                ),

                disnake.ui.Separator(
                    spacing=(
                        disnake.SeparatorSpacing.small
                    )
                ),

                *cls._main_buttons(
                    config
                ),

                **cls._container_kwargs(),
            ),

            cls._back_button(
                "VoltarAutomações"
            ),
        ]

    @classmethod
    def PainelEmbed(
        cls,
    ):

        config = cls._get_config()

        embed = disnake.Embed(
            title="Limpeza de Canais",
            description=(
                "Configure canais para terem mensagens "
                "apagadas automaticamente em intervalos definidos."
            ),
        )

        cls._apply_embed_color(
            embed
        )

        embed.add_field(
            name="Configurações",
            value=cls._summary(
                config
            ),
            inline=False,
        )

        embed.add_field(
            name="Canais",
            value=cls._channels_preview(
                config
            ),
            inline=False,
        )

        components = [
            *cls._main_buttons(
                config
            ),

            cls._back_button(
                "VoltarAutomações"
            ),
        ]

        return embed, components

    # ═════════════════════════════════════════════════════════
    # ADICIONAR CANAL
    # ═════════════════════════════════════════════════════════

    @classmethod
    def PainelAdicionarCanal(
        cls,
    ) -> list:

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Automações › "
                    "Limpeza de Canais › **Adicionar Canal**"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Selecione o canal que deseja configurar "
                    "para limpeza automática."
                ),

                disnake.ui.ActionRow(
                    disnake.ui.ChannelSelect(
                        placeholder=(
                            "Selecione um canal de texto"
                        ),
                        custom_id=(
                            "Limpeza_SelectCanal"
                        ),
                        min_values=1,
                        max_values=1,
                        channel_types=[
                            disnake.ChannelType.text
                        ],
                    )
                ),

                **cls._container_kwargs(),
            ),

            cls._back_button(
                "Limpeza_VoltarPainel"
            ),
        ]

    @classmethod
    def PainelAdicionarCanalEmbed(
        cls,
    ):

        embed = disnake.Embed(
            title="Adicionar Canal",
            description=(
                "Selecione o canal que deseja configurar "
                "para limpeza automática."
            ),
        )

        cls._apply_embed_color(
            embed
        )

        return (
            embed,
            [
                disnake.ui.ActionRow(
                    disnake.ui.ChannelSelect(
                        placeholder=(
                            "Selecione um canal de texto"
                        ),
                        custom_id=(
                            "Limpeza_SelectCanal"
                        ),
                        min_values=1,
                        max_values=1,
                        channel_types=[
                            disnake.ChannelType.text
                        ],
                    )
                ),

                cls._back_button(
                    "Limpeza_VoltarPainel"
                ),
            ],
        )

    # ═════════════════════════════════════════════════════════
    # REMOVER CANAL
    # ═════════════════════════════════════════════════════════

    @classmethod
    def PainelRemoverCanal(
        cls,
    ) -> list:

        return [
            disnake.ui.Container(
                disnake.ui.TextDisplay(
                    f"# {emoji.zuros}\n"
                    "-# Painel › Automações › "
                    "Limpeza de Canais › **Remover Canal**"
                ),

                disnake.ui.Separator(),

                disnake.ui.TextDisplay(
                    "Selecione um canal que esteja configurado "
                    "na limpeza automática."
                ),

                disnake.ui.ActionRow(
                    disnake.ui.ChannelSelect(
                        placeholder=(
                            "Selecione o canal para remover"
                        ),
                        custom_id=(
                            "Limpeza_RemoverSelectCanal"
                        ),
                        min_values=1,
                        max_values=1,
                        channel_types=[
                            disnake.ChannelType.text
                        ],
                    )
                ),

                **cls._container_kwargs(),
            ),

            cls._back_button(
                "Limpeza_VoltarPainel"
            ),
        ]

    @classmethod
    def PainelRemoverCanalEmbed(
        cls,
    ):

        embed = disnake.Embed(
            title="Remover Canal",
            description=(
                "Selecione um canal que esteja configurado "
                "na limpeza automática."
            ),
        )

        cls._apply_embed_color(
            embed
        )

        return (
            embed,
            [
                disnake.ui.ActionRow(
                    disnake.ui.ChannelSelect(
                        placeholder=(
                            "Selecione o canal para remover"
                        ),
                        custom_id=(
                            "Limpeza_RemoverSelectCanal"
                        ),
                        min_values=1,
                        max_values=1,
                        channel_types=[
                            disnake.ChannelType.text
                        ],
                    )
                ),

                cls._back_button(
                    "Limpeza_VoltarPainel"
                ),
            ],
        )

    # ═════════════════════════════════════════════════════════
    # ATUALIZAR PAINEL
    # ═════════════════════════════════════════════════════════

    async def _show_main(
        self,
        inter,
    ):
        mode = self._get_mode()

        if mode == "embed":
            embed, components = (
                self.PainelEmbed()
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await inter.edit_original_message(
                content=None,
                components=self.Painel(),
            )

    # ═════════════════════════════════════════════════════════
    # BOTÕES
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_button_click"
    )
    async def Limpeza_Button_Listener(
        self,
        inter: disnake.MessageInteraction,
    ):
        custom_id = (
            inter.component.custom_id
            or ""
        )

        if not custom_id.startswith(
            "Limpeza_"
        ):
            return

        # ─────────────────────────────────────────
        # DESATIVAR LOG PELO PRÓPRIO LOG
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_DesativarLogsViaLog"
        ):
            config_bot = (
                db.obter("config.json")
                or {}
            )

            permissoes = (
                config_bot
                .get("bot", {})
                .get("perms", [])
            )

            permissoes = {
                str(user_id)
                for user_id
                in permissoes
            }

            if (
                str(inter.author.id)
                not in permissoes
            ):
                await inter.response.send_message(
                    f"{emoji.wrong} Você não possui "
                    "permissão para fazer isso.",
                    ephemeral=True,
                )
                return

            helpers.salvar_config({
                "logs_ativados": False
            })

            await inter.response.send_message(
                f"{emoji.on} As logs da limpeza automática "
                "foram **desativadas**.\n\n"
                "Você pode ativá-las novamente em "
                "**Painel › Automações › Limpeza de Canais**.",
                ephemeral=True,
            )

            try:
                await inter.message.delete()

            except (
                disnake.NotFound,
                disnake.Forbidden,
                disnake.HTTPException,
            ):
                pass

            return

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

        # ─────────────────────────────────────────
        # STATUS
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_ToggleAtivo"
        ):
            config = self._get_config()

            config["ativado"] = not bool(
                config.get(
                    "ativado",
                    False,
                )
            )

            helpers.salvar_config(
                config
            )

            self._restart_task()

            await self._show_main(
                inter
            )

            return

        # ─────────────────────────────────────────
        # LOGS
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_ToggleLogs"
        ):
            config = self._get_config()

            config["logs_ativados"] = not bool(
                config.get(
                    "logs_ativados",
                    False,
                )
            )

            helpers.salvar_config(
                config
            )

            await self._show_main(
                inter
            )

            return

        # ─────────────────────────────────────────
        # VOLTAR
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_VoltarPainel"
        ):
            await self._show_main(
                inter
            )

            return

        # ─────────────────────────────────────────
        # ADICIONAR
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_AdicionarCanal"
        ):
            if mode == "embed":
                embed, components = (
                    self.PainelAdicionarCanalEmbed()
                )

                await inter.edit_original_message(
                    content=None,
                    embed=embed,
                    components=components,
                )

            else:
                await inter.edit_original_message(
                    content=None,
                    components=(
                        self.PainelAdicionarCanal()
                    ),
                )

            return

        # ─────────────────────────────────────────
        # REMOVER
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_RemoverCanal"
        ):
            config = self._get_config()

            if not config.get("canais"):
                await self._show_main(
                    inter
                )
                return

            if mode == "embed":
                embed, components = (
                    self.PainelRemoverCanalEmbed()
                )

                await inter.edit_original_message(
                    content=None,
                    embed=embed,
                    components=components,
                )

            else:
                await inter.edit_original_message(
                    content=None,
                    components=(
                        self.PainelRemoverCanal()
                    ),
                )

    # ═════════════════════════════════════════════════════════
    # DROPDOWNS
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_dropdown"
    )
    async def Limpeza_Select_Listener(
        self,
        inter: disnake.MessageInteraction,
    ):
        custom_id = (
            inter.component.custom_id
            or ""
        )

        if not custom_id.startswith(
            "Limpeza_"
        ):
            return

        if not inter.values:
            return

        # ─────────────────────────────────────────
        # ADICIONAR / CONFIGURAR
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_SelectCanal"
        ):
            canal_id = str(
                inter.values[0]
            )

            config = self._get_config()

            canal_config = (
                config
                .get("canais", {})
                .get(
                    canal_id,
                    {},
                )
            )

            try:
                intervalo_atual = int(
                    canal_config.get(
                        "intervalo_minutos",
                        DEFAULT_INTERVAL,
                    )
                )

            except (
                TypeError,
                ValueError,
            ):
                intervalo_atual = (
                    DEFAULT_INTERVAL
                )

            await inter.response.send_modal(
                ConfigurarLimpezaModal(
                    canal_id=canal_id,
                    intervalo_atual=intervalo_atual,
                )
            )

            return

        # ─────────────────────────────────────────
        # REMOVER
        # ─────────────────────────────────────────

        if (
            custom_id
            == "Limpeza_RemoverSelectCanal"
        ):
            canal_id = str(
                inter.values[0]
            )

            config = self._get_config()

            canais = (
                config.get("canais")
                or {}
            )

            if canal_id not in canais:
                await inter.response.send_message(
                    f"{emoji.wrong} Esse canal não está "
                    "configurado na limpeza automática.",
                    ephemeral=True,
                )
                return

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

            del canais[canal_id]

            config["canais"] = canais

            helpers.salvar_config(
                config
            )

            self._restart_task()

            await self._show_main(
                inter
            )


# ═════════════════════════════════════════════════════════════
# MODAL — CONFIGURAR INTERVALO
# ═════════════════════════════════════════════════════════════

class ConfigurarLimpezaModal(
    disnake.ui.Modal
):
    def __init__(
        self,
        canal_id: str,
        intervalo_atual: int = DEFAULT_INTERVAL,
    ):
        self.canal_id = str(
            canal_id
        )

        try:
            intervalo_atual = int(
                intervalo_atual
            )

        except (
            TypeError,
            ValueError,
        ):
            intervalo_atual = (
                DEFAULT_INTERVAL
            )

        components = [
            disnake.ui.TextInput(
                label="Intervalo em minutos",
                placeholder=(
                    "Ex: 60 = 1h | 1440 = 24h"
                ),
                value=str(
                    max(
                        1,
                        intervalo_atual,
                    )
                ),
                custom_id="intervalo",
                style=(
                    disnake.TextInputStyle.short
                ),
                required=True,
                min_length=1,
                max_length=6,
            )
        ]

        super().__init__(
            title="Configurar Limpeza",
            custom_id=(
                f"Limpeza_ConfigModal_"
                f"{self.canal_id}"
            ),
            components=components,
        )

    async def callback(
        self,
        inter: disnake.ModalInteraction,
    ):
        texto = (
            inter.text_values
            .get(
                "intervalo",
                str(DEFAULT_INTERVAL),
            )
            .strip()
        )

        try:
            intervalo = int(
                texto
            )

        except (
            TypeError,
            ValueError,
        ):
            await inter.response.send_message(
                f"{emoji.wrong} Informe um número válido.\n"
                "Exemplo: `60` para 1 hora ou "
                "`1440` para 24 horas.",
                ephemeral=True,
            )
            return

        if intervalo < 1:
            await inter.response.send_message(
                f"{emoji.wrong} O intervalo mínimo é "
                "**1 minuto**.",
                ephemeral=True,
            )
            return

        if intervalo > MAX_INTERVAL:
            await inter.response.send_message(
                f"{emoji.wrong} O intervalo máximo é "
                f"`{MAX_INTERVAL}` minutos.",
                ephemeral=True,
            )
            return

        mode = CleanCog._get_mode()

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

        config = (
            helpers.carregar_config()
            or {}
        )

        canais = config.setdefault(
            "canais",
            {},
        )

        agora = datetime.now(
            TIMEZONE
        )

        proxima_limpeza = (
            agora
            + timedelta(
                minutes=intervalo
            )
        )

        canais[self.canal_id] = {
            "intervalo_minutos": intervalo,
            "proxima_limpeza": (
                proxima_limpeza.isoformat()
            ),
        }

        helpers.salvar_config(
            config
        )

        task_cog = inter.bot.get_cog(
            "CleanTaskCog"
        )

        if task_cog:
            try:
                task_cog.restart_task()

            except Exception:
                logger.exception(
                    "Erro ao reiniciar a task "
                    "de limpeza."
                )

        if mode == "embed":
            embed, components = (
                CleanCog.PainelEmbed()
            )

            await inter.edit_original_message(
                content=None,
                embed=embed,
                components=components,
            )

        else:
            await inter.edit_original_message(
                content=None,
                components=CleanCog.Painel(),
            )


def setup(bot: commands.Bot):
    bot.add_cog(
        CleanCog(bot)
    )