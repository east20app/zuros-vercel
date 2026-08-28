import logging

import disnake
from disnake.ext import commands

from ._common import (
    obter_canal_id,
    enviar_log,
    buscar_executor_auditlog,
    verificar_guild,
)
from functions.emoji import emoji


logger = logging.getLogger(__name__)


class OnVoiceStateUpdate(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _get_voice_events(
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ) -> list[str]:
        """
        Retorna alterações ocorridas no estado de voz.
        """

        eventos = []

        # ─────────────────────────────────────────
        # STREAM
        # ─────────────────────────────────────────

        if before.self_stream != after.self_stream:
            eventos.append(
                "Iniciou streaming"
                if after.self_stream
                else "Parou o streaming"
            )

        # ─────────────────────────────────────────
        # MICROFONE
        # ─────────────────────────────────────────

        if before.self_mute != after.self_mute:
            eventos.append(
                "Mutou o microfone"
                if after.self_mute
                else "Desmutou o microfone"
            )

        # ─────────────────────────────────────────
        # ÁUDIO
        # ─────────────────────────────────────────

        if before.self_deaf != after.self_deaf:
            eventos.append(
                "Desativou o áudio"
                if after.self_deaf
                else "Ativou o áudio"
            )

        # ─────────────────────────────────────────
        # MUTE PELO SERVIDOR
        # ─────────────────────────────────────────

        if before.mute != after.mute:
            eventos.append(
                "Foi mutado pelo servidor"
                if after.mute
                else "Foi desmutado pelo servidor"
            )

        # ─────────────────────────────────────────
        # DEAF PELO SERVIDOR
        # ─────────────────────────────────────────

        if before.deaf != after.deaf:
            eventos.append(
                "Foi ensurdecido pelo servidor"
                if after.deaf
                else "Deixou de ser ensurdecido pelo servidor"
            )

        # ─────────────────────────────────────────
        # VÍDEO
        # ─────────────────────────────────────────

        if before.self_video != after.self_video:
            eventos.append(
                "Ligou a câmera"
                if after.self_video
                else "Desligou a câmera"
            )

        return eventos

    @staticmethod
    def _channel_changed(
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ) -> bool:
        return before.channel != after.channel

    @staticmethod
    def _is_join(
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ) -> bool:
        return (
            before.channel is None
            and after.channel is not None
        )

    @staticmethod
    def _is_leave(
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ) -> bool:
        return (
            before.channel is not None
            and after.channel is None
        )

    @staticmethod
    def _is_move(
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ) -> bool:
        return (
            before.channel is not None
            and after.channel is not None
            and before.channel.id != after.channel.id
        )

    async def _get_move_executor(
        self,
        member: disnake.Member,
    ):
        """
        Procura quem moveu o membro pelo Audit Log.

        Se não houver registro, considera uma troca
        normal feita pelo próprio usuário.
        """

        try:
            return await buscar_executor_auditlog(
                member.guild,
                [
                    disnake.AuditLogAction.member_move
                ],
                lambda entry: (
                    getattr(
                        entry.target,
                        "id",
                        None,
                    )
                    == member.id
                ),
            )

        except (
            disnake.Forbidden,
            disnake.HTTPException,
        ):
            return None

        except Exception:
            logger.exception(
                "Erro ao consultar Audit Log "
                "para movimentação de voz."
            )
            return None

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_voice_state_update"
    )
    async def on_voice_state_update(
        self,
        member: disnake.Member,
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ):
        guild = member.guild

        if not guild:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        canal_logs_id = obter_canal_id(
            "canal_de_logs_de_trafego_em_call"
        )

        if not canal_logs_id:
            return

        mudou_canal = self._channel_changed(
            before,
            after,
        )

        entrou = self._is_join(
            before,
            after,
        )

        saiu = self._is_leave(
            before,
            after,
        )

        moveu = self._is_move(
            before,
            after,
        )

        eventos = self._get_voice_events(
            before,
            after,
        )

        # Nenhuma alteração relevante.
        if not mudou_canal and not eventos:
            return

        linhas = [
            (
                f"{emoji.member} **Membro:** "
                f"{member.mention} (`{member.id}`)"
            )
        ]

        # ═════════════════════════════════════════
        # ENTROU
        # ═════════════════════════════════════════

        if entrou and after.channel:
            linhas.append(
                f"{emoji.route} **Entrou em call:** "
                f"{after.channel.mention}"
            )

        # ═════════════════════════════════════════
        # SAIU
        # ═════════════════════════════════════════

        elif saiu and before.channel:
            linhas.append(
                f"{emoji.route} **Saiu da call:** "
                f"{before.channel.mention}"
            )

        # ═════════════════════════════════════════
        # MOVEU
        # ═════════════════════════════════════════

        elif (
            moveu
            and before.channel
            and after.channel
        ):
            executor = await self._get_move_executor(
                member
            )

            if executor:
                linhas.append(
                    f"{emoji.member} **Movido por:** "
                    f"{executor.mention} "
                    f"(`{executor.id}`)"
                )

            else:
                linhas.append(
                    f"{emoji.route} "
                    "**Alterou de canal de voz**"
                )

            linhas.append(
                f"{emoji.route} "
                f"{before.channel.mention} "
                f"➜ "
                f"{after.channel.mention}"
            )

        # ═════════════════════════════════════════
        # OUTRAS ALTERAÇÕES
        # ═════════════════════════════════════════

        if eventos:
            linhas.append(
                f"{emoji.route} "
                f"**Alterações:**"
            )

            linhas.extend(
                f"{emoji.arrow} {evento}"
                for evento in eventos
            )

        # ═════════════════════════════════════════
        # ENVIAR LOG
        # ═════════════════════════════════════════

        try:
            await enviar_log(
                guild,
                canal_logs_id,
                "Logs de Tráfego em Call",
                linhas,
            )

        except Exception:
            logger.exception(
                "Erro ao enviar log de tráfego "
                "em canal de voz."
            )


def setup(bot: commands.Bot):
    bot.add_cog(
        OnVoiceStateUpdate(bot)
    )