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

AUDIT_MAX_AGE = 30


class OnMemberUpdateRoles(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

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

    @staticmethod
    def _role_ids(
        member: disnake.Member,
    ) -> set[int]:
        return {
            role.id
            for role in member.roles
            if not role.is_default()
        }

    async def _find_executor(
        self,
        member: disnake.Member,
    ):
        try:
            return await buscar_executor_auditlog(
                member.guild,
                [
                    disnake.AuditLogAction.member_role_update,
                ],
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
                "de alteração de cargos.",
                exc_info=True,
            )
            return None

        except Exception:
            logger.exception(
                "Erro ao localizar executor "
                "de alteração de cargos."
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

        # ─────────────────────────────────────────
        # DETECTAR ALTERAÇÕES
        # ─────────────────────────────────────────

        before_ids = self._role_ids(
            before
        )

        after_ids = self._role_ids(
            after
        )

        added_ids = (
            after_ids
            - before_ids
        )

        removed_ids = (
            before_ids
            - after_ids
        )

        if not added_ids and not removed_ids:
            return

        canal_add = obter_canal_id(
            "canal_de_logs_de_cargos_adicionados"
        )

        canal_rem = obter_canal_id(
            "canal_de_logs_de_cargos_removidos"
        )

        if not canal_add and not canal_rem:
            return

        # ─────────────────────────────────────────
        # CARGOS
        # ─────────────────────────────────────────

        adicionados = [
            role
            for role in after.roles
            if role.id in added_ids
        ]

        removidos = [
            role
            for role in before.roles
            if role.id in removed_ids
        ]

        # ─────────────────────────────────────────
        # EXECUTOR
        # ─────────────────────────────────────────

        executor = await self._find_executor(
            after
        )

        executor_text = (
            self._format_executor(
                executor
            )
        )

        base_linhas = [
            (
                f"{emoji.member} "
                f"**Membro:** "
                f"{after.mention} "
                f"(`{after.id}`)"
            ),

            (
                f"{emoji.member} "
                f"**Executor:** "
                f"{executor_text}"
            ),
        ]

        # ═════════════════════════════════════════
        # CARGOS ADICIONADOS
        # ═════════════════════════════════════════

        if adicionados and canal_add:
            linhas = list(
                base_linhas
            )

            if len(adicionados) == 1:
                role = adicionados[0]

                linhas.append(
                    f"{emoji.plus} "
                    f"**Cargo adicionado:** "
                    f"{role.mention} "
                    f"(`{role.id}`)"
                )

            else:
                linhas.append(
                    f"{emoji.plus} "
                    f"**Cargos adicionados:** "
                    f"`{len(adicionados)}`"
                )

                for role in adicionados:
                    linhas.append(
                        f"{emoji.arrow} "
                        f"{role.mention} "
                        f"(`{role.id}`)"
                    )

            try:
                await enviar_log(
                    guild,
                    canal_add,
                    "Logs de Cargos - Adicionados",
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de cargos "
                    "adicionados no servidor %s.",
                    guild.id,
                )

        # ═════════════════════════════════════════
        # CARGOS REMOVIDOS
        # ═════════════════════════════════════════

        if removidos and canal_rem:
            linhas = list(
                base_linhas
            )

            if len(removidos) == 1:
                role = removidos[0]

                linhas.append(
                    f"{emoji.minus} "
                    f"**Cargo removido:** "
                    f"{role.mention} "
                    f"(`{role.id}`)"
                )

            else:
                linhas.append(
                    f"{emoji.minus} "
                    f"**Cargos removidos:** "
                    f"`{len(removidos)}`"
                )

                for role in removidos:
                    linhas.append(
                        f"{emoji.arrow} "
                        f"{role.mention} "
                        f"(`{role.id}`)"
                    )

            try:
                await enviar_log(
                    guild,
                    canal_rem,
                    "Logs de Cargos - Removidos",
                    linhas,
                )

            except Exception:
                logger.exception(
                    "Erro ao enviar log de cargos "
                    "removidos no servidor %s.",
                    guild.id,
                )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnMemberUpdateRoles(bot)
    )