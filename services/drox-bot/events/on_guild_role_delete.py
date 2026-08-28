import asyncio
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


AUDIT_DELAY = 0.7
AUDIT_RETRIES = 3
AUDIT_RETRY_DELAY = 0.7
AUDIT_MAX_AGE = 30


class OnGuildRoleDelete(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _format_executor(
        executor,
    ) -> str:
        """
        Formata o executor com menção e ID.
        """

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
    def _format_bool(
        value: bool,
    ) -> str:
        return (
            "`Sim`"
            if value
            else "`Não`"
        )

    @staticmethod
    def _format_colour(
        role: disnake.Role,
    ) -> str:
        """
        Formata a cor do cargo em hexadecimal.
        """

        try:
            value = int(
                role.colour.value
            )

            return f"`#{value:06X}`"

        except Exception:
            return f"`{role.colour}`"

    @staticmethod
    def _permissions_count(
        role: disnake.Role,
    ) -> int:
        """
        Retorna quantas permissões estavam
        habilitadas no cargo.
        """

        try:
            return sum(
                1
                for _, enabled
                in role.permissions
                if enabled
            )

        except Exception:
            return 0

    async def _find_executor(
        self,
        role: disnake.Role,
    ):
        """
        Procura quem excluiu o cargo.

        O Audit Log pode demorar alguns instantes
        para registrar a exclusão.
        """

        await asyncio.sleep(
            AUDIT_DELAY
        )

        for attempt in range(
            AUDIT_RETRIES
        ):
            try:
                executor = (
                    await buscar_executor_auditlog(
                        role.guild,
                        [
                            disnake.AuditLogAction.role_delete,
                        ],
                        lambda entry: (
                            getattr(
                                getattr(
                                    entry,
                                    "target",
                                    None,
                                ),
                                "id",
                                None,
                            )
                            == role.id
                        ),
                        max_age_seconds=(
                            AUDIT_MAX_AGE
                        ),
                    )
                )

                if executor is not None:
                    return executor

            except disnake.Forbidden:
                logger.warning(
                    "Sem permissão para consultar "
                    "Audit Log no servidor %s.",
                    role.guild.id,
                )

                return None

            except disnake.HTTPException:
                logger.debug(
                    "Erro HTTP ao consultar Audit Log "
                    "de exclusão de cargo.",
                    exc_info=True,
                )

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "Erro ao localizar executor "
                    "da exclusão do cargo %s.",
                    role.id,
                )

                return None

            if attempt < AUDIT_RETRIES - 1:
                await asyncio.sleep(
                    AUDIT_RETRY_DELAY
                )

        return None

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_guild_role_delete"
    )
    async def on_guild_role_delete(
        self,
        role: disnake.Role,
    ):
        guild = role.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        canal_id = obter_canal_id(
            "canal_de_logs_de_cargos_excluidos"
        )

        if not canal_id:
            return

        # ═════════════════════════════════════════
        # EXECUTOR
        # ═════════════════════════════════════════

        executor = await self._find_executor(
            role
        )

        executor_text = (
            self._format_executor(
                executor
            )
        )

        # ═════════════════════════════════════════
        # DADOS DO CARGO
        # ═════════════════════════════════════════

        colour = self._format_colour(
            role
        )

        permissions_count = (
            self._permissions_count(
                role
            )
        )

        # ═════════════════════════════════════════
        # LOG
        # ═════════════════════════════════════════

        linhas = [
            (
                f"{emoji.role} "
                f"**Cargo excluído:** "
                f"**{role.name}** "
                f"(`{role.id}`)"
            ),

            (
                f"{emoji.wand} "
                f"**Cor:** "
                f"{colour}"
            ),

            (
                f"{emoji.pin} "
                f"**Posição:** "
                f"`{role.position}`"
            ),

            (
                f"{emoji.pin} "
                f"**Mencionável:** "
                f"{self._format_bool(role.mentionable)}"
                f" | "
                f"**Separado:** "
                f"{self._format_bool(role.hoist)}"
            ),

            (
                f"{emoji.role} "
                f"**Permissões habilitadas:** "
                f"`{permissions_count}`"
            ),

            (
                f"{emoji.member} "
                f"**Executor:** "
                f"{executor_text}"
            ),
        ]

        # ═════════════════════════════════════════
        # CARGO GERENCIADO
        # ═════════════════════════════════════════

        if role.managed:
            linhas.insert(
                5,
                (
                    f"{emoji.role} "
                    "**Cargo gerenciado:** `Sim`"
                ),
            )

        # ═════════════════════════════════════════
        # ENVIAR
        # ═════════════════════════════════════════

        try:
            await enviar_log(
                guild,
                canal_id,
                "Logs de Cargos - Excluídos",
                linhas,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro ao enviar log de exclusão "
                "do cargo %s no servidor %s.",
                role.id,
                guild.id,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnGuildRoleDelete(bot)
    )