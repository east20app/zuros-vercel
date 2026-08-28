import logging
from datetime import datetime, timezone

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


AUDIT_MAX_AGE = 30


class OnMemberUpdateTimeout(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _get_timeout(
        member: disnake.Member,
    ) -> datetime | None:
        """
        Obtém o timeout atual do membro.

        Usa current_timeout, mas mantém fallback para
        timed_out_until para compatibilidade com versões antigas.
        """

        timeout = getattr(
            member,
            "current_timeout",
            None,
        )

        if timeout is None:
            timeout = getattr(
                member,
                "timed_out_until",
                None,
            )

        return timeout

    @staticmethod
    def _normalize_datetime(
        value: datetime | None,
    ) -> datetime | None:
        """
        Garante que o datetime tenha timezone.
        """

        if value is None:
            return None

        if value.tzinfo is None:
            return value.replace(
                tzinfo=timezone.utc
            )

        return value.astimezone(
            timezone.utc
        )

    @classmethod
    def _timestamp(
        cls,
        value: datetime,
    ) -> int:
        value = cls._normalize_datetime(
            value
        )

        return int(
            value.timestamp()
        )

    @staticmethod
    def _format_executor(
        executor,
    ) -> str:
        if executor is None:
            return "`Não identificado`"

        mention = getattr(
            executor,
            "mention",
            str(executor),
        )

        executor_id = getattr(
            executor,
            "id",
            None,
        )

        if executor_id is None:
            return mention

        return (
            f"{mention} "
            f"(`{executor_id}`)"
        )

    async def _find_executor(
        self,
        member: disnake.Member,
        *,
        applied: bool = False,
    ):
        """
        Procura quem alterou o timeout no Audit Log.
        """

        actions = [
            disnake.AuditLogAction.member_update,
        ]

        # Timeout também pode ter vindo
        # do AutoMod do Discord.
        if applied and hasattr(
            disnake.AuditLogAction,
            "automod_timeout",
        ):
            actions.append(
                disnake.AuditLogAction.automod_timeout
            )

        try:
            return await buscar_executor_auditlog(
                member.guild,
                actions,
                lambda entry: (
                    getattr(
                        entry.target,
                        "id",
                        None,
                    )
                    == member.id
                ),
                max_age_seconds=AUDIT_MAX_AGE,
            )

        except disnake.Forbidden:
            return None

        except disnake.HTTPException:
            logger.debug(
                "Erro HTTP ao consultar Audit Log "
                "de timeout.",
                exc_info=True,
            )
            return None

        except Exception:
            logger.exception(
                "Erro ao localizar executor "
                "de alteração de timeout."
            )
            return None

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_member_update"
    )
    async def on_member_update(
        self,
        before: disnake.Member,
        after: disnake.Member,
    ):
        guild = after.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        before_timeout = (
            self._normalize_datetime(
                self._get_timeout(before)
            )
        )

        after_timeout = (
            self._normalize_datetime(
                self._get_timeout(after)
            )
        )

        # Nenhuma alteração no castigo.
        if before_timeout == after_timeout:
            return

        canal_id = obter_canal_id(
            "canal_de_logs_de_castigos"
        )

        if not canal_id:
            return

        # ═════════════════════════════════════════
        # CASTIGO APLICADO
        # None -> datetime
        # ═════════════════════════════════════════

        if (
            before_timeout is None
            and after_timeout is not None
        ):
            executor = await self._find_executor(
                after,
                applied=True,
            )

            executor_text = (
                self._format_executor(
                    executor
                )
            )

            timestamp = self._timestamp(
                after_timeout
            )

            linhas = [
                (
                    f"{emoji.member} "
                    f"**Membro:** "
                    f"{after.mention} "
                    f"(`{after.id}`)"
                ),

                (
                    f"{emoji.clock} "
                    f"**Castigo aplicado até:** "
                    f"<t:{timestamp}:f> "
                    f"(<t:{timestamp}:R>)"
                ),

                (
                    f"{emoji.member} "
                    f"**Executor:** "
                    f"{executor_text}"
                ),
            ]

            try:
                await enviar_log(
                    guild,
                    canal_id,
                    "Logs de Castigos - Aplicados",
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de castigo "
                    "aplicado no servidor %s.",
                    guild.id,
                )

            return

        # ═════════════════════════════════════════
        # CASTIGO REMOVIDO / EXPIRADO
        # datetime -> None
        # ═════════════════════════════════════════

        if (
            before_timeout is not None
            and after_timeout is None
        ):
            now = datetime.now(
                timezone.utc
            )

            # Se o horário do timeout já chegou,
            # provavelmente expirou naturalmente.
            expired_automatically = (
                before_timeout <= now
            )

            if expired_automatically:
                linhas = [
                    (
                        f"{emoji.member} "
                        f"**Membro:** "
                        f"{after.mention} "
                        f"(`{after.id}`)"
                    ),

                    (
                        f"{emoji.unlock} "
                        "**Castigo expirado automaticamente**"
                    ),

                    (
                        f"{emoji.clock} "
                        f"**Expirou em:** "
                        f"<t:{self._timestamp(before_timeout)}:f>"
                    ),
                ]

                titulo = (
                    "Logs de Castigos - Expirados"
                )

            else:
                executor = (
                    await self._find_executor(
                        after
                    )
                )

                executor_text = (
                    self._format_executor(
                        executor
                    )
                )

                linhas = [
                    (
                        f"{emoji.member} "
                        f"**Membro:** "
                        f"{after.mention} "
                        f"(`{after.id}`)"
                    ),

                    (
                        f"{emoji.unlock} "
                        "**Castigo removido antes do término**"
                    ),

                    (
                        f"{emoji.clock} "
                        f"**Término original:** "
                        f"<t:{self._timestamp(before_timeout)}:f> "
                        f"(<t:{self._timestamp(before_timeout)}:R>)"
                    ),

                    (
                        f"{emoji.member} "
                        f"**Executor:** "
                        f"{executor_text}"
                    ),
                ]

                titulo = (
                    "Logs de Castigos - Removidos"
                )

            try:
                await enviar_log(
                    guild,
                    canal_id,
                    titulo,
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de remoção "
                    "de castigo no servidor %s.",
                    guild.id,
                )

            return

        # ═════════════════════════════════════════
        # CASTIGO ALTERADO
        # datetime -> datetime
        # ═════════════════════════════════════════

        if (
            before_timeout is not None
            and after_timeout is not None
        ):
            executor = await self._find_executor(
                after
            )

            executor_text = (
                self._format_executor(
                    executor
                )
            )

            before_timestamp = (
                self._timestamp(
                    before_timeout
                )
            )

            after_timestamp = (
                self._timestamp(
                    after_timeout
                )
            )

            # ─────────────────────────────────────
            # AUMENTADO
            # ─────────────────────────────────────

            if after_timeout > before_timeout:
                alteracao = (
                    f"{emoji.plus} "
                    "**Duração aumentada**"
                )

                titulo = (
                    "Logs de Castigos - Alterados"
                )

            # ─────────────────────────────────────
            # REDUZIDO
            # ─────────────────────────────────────

            else:
                alteracao = (
                    f"{emoji.minus} "
                    "**Duração reduzida**"
                )

                titulo = (
                    "Logs de Castigos - Alterados"
                )

            linhas = [
                (
                    f"{emoji.member} "
                    f"**Membro:** "
                    f"{after.mention} "
                    f"(`{after.id}`)"
                ),

                alteracao,

                (
                    f"{emoji.clock} "
                    f"**Antes:** "
                    f"<t:{before_timestamp}:f> "
                    f"(<t:{before_timestamp}:R>)"
                ),

                (
                    f"{emoji.clock} "
                    f"**Agora:** "
                    f"<t:{after_timestamp}:f> "
                    f"(<t:{after_timestamp}:R>)"
                ),

                (
                    f"{emoji.member} "
                    f"**Executor:** "
                    f"{executor_text}"
                ),
            ]

            try:
                await enviar_log(
                    guild,
                    canal_id,
                    titulo,
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de alteração "
                    "de castigo no servidor %s.",
                    guild.id,
                )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnMemberUpdateTimeout(bot)
    )