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
from functions.database import database as db
from modules.tickets.functions.setup_functions.close_ticket import (
    close_ticket,
)


logger = logging.getLogger(__name__)


AUDIT_MAX_AGE = 30
AUDIT_DELAY = 0.7


class OnMemberRemove(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _format_user(
        user,
    ) -> str:
        if user is None:
            return "`Não identificado`"

        mention = getattr(
            user,
            "mention",
            str(user),
        )

        user_id = getattr(
            user,
            "id",
            None,
        )

        if user_id is None:
            return mention

        return (
            f"{mention} "
            f"(`{user_id}`)"
        )

    async def _find_kick_executor(
        self,
        member: disnake.Member,
    ):
        """
        Procura uma expulsão recente no Audit Log.

        on_member_remove também ocorre quando o membro
        sai voluntariamente, então só consideramos kick
        quando existe uma entrada correspondente.
        """

        try:
            # Dá um pequeno tempo para o Discord
            # registrar o evento no Audit Log.
            await asyncio.sleep(
                AUDIT_DELAY
            )

            return await buscar_executor_auditlog(
                member.guild,
                [
                    disnake.AuditLogAction.kick,
                ],
                lambda entry: (
                    getattr(
                        entry.target,
                        "id",
                        None,
                    )
                    == member.id
                ),
                max_age_seconds=(
                    AUDIT_MAX_AGE
                ),
            )

        except disnake.Forbidden:
            return None

        except disnake.HTTPException:
            logger.debug(
                "Erro HTTP ao consultar Audit Log "
                "de expulsão.",
                exc_info=True,
            )
            return None

        except Exception:
            logger.exception(
                "Erro ao consultar executor "
                "da expulsão do membro %s.",
                member.id,
            )
            return None

    # ═════════════════════════════════════════════════════════
    # AUTO CLOSE TICKETS
    # ═════════════════════════════════════════════════════════

    async def auto_close_tickets(
        self,
        member: disnake.Member,
    ) -> None:
        """
        Fecha tickets abertos quando o usuário sai
        do servidor, caso essa preferência esteja ativa.
        """

        try:
            tickets_data = (
                db.obter(
                    "database/tickets/tickets_data.json"
                )
                or {}
            )

            config = (
                db.obter(
                    "database/tickets/tickets_config.json"
                )
                or {}
            )

        except Exception:
            logger.exception(
                "Erro ao carregar configurações "
                "dos tickets."
            )
            return

        if not isinstance(
            tickets_data,
            dict,
        ):
            return

        if not isinstance(
            config,
            dict,
        ):
            return

        panels_data = (
            tickets_data.get("panels")
            or {}
        )

        panels_config = (
            config.get("panels")
            or {}
        )

        if not isinstance(
            panels_data,
            dict,
        ):
            return

        user_id = str(
            member.id
        )

        for panel_id, users in list(
            panels_data.items()
        ):
            if not isinstance(
                users,
                dict,
            ):
                continue

            user_tickets = users.get(
                user_id
            )

            if not isinstance(
                user_tickets,
                list,
            ):
                continue

            # ─────────────────────────────────────
            # CONFIGURAÇÃO DO PAINEL
            # ─────────────────────────────────────

            panel_config = (
                panels_config.get(
                    panel_id,
                    {}
                )
                or {}
            )

            preferences = (
                panel_config.get(
                    "preferences",
                    {}
                )
                or {}
            )

            auto_close = (
                preferences.get(
                    "auto_close",
                    {}
                )
                or {}
            )

            user_left = (
                auto_close.get(
                    "user_left",
                    {}
                )
                or {}
            )

            if not user_left.get(
                "enabled",
                False,
            ):
                continue

            # ─────────────────────────────────────
            # TICKETS ABERTOS
            # ─────────────────────────────────────

            open_tickets = [
                ticket
                for ticket in user_tickets
                if (
                    isinstance(ticket, dict)
                    and ticket.get("status")
                    == "open"
                )
            ]

            if not open_tickets:
                continue

            for ticket in open_tickets:
                ticket_id = ticket.get(
                    "ticket_id"
                )

                if not ticket_id:
                    continue

                try:
                    ticket_id = int(
                        ticket_id
                    )

                except (
                    TypeError,
                    ValueError,
                ):
                    logger.warning(
                        "Ticket com ID inválido: %r",
                        ticket_id,
                    )
                    continue

                # ─────────────────────────────────
                # LOCALIZAR CANAL
                # ─────────────────────────────────

                channel = (
                    member.guild.get_channel(
                        ticket_id
                    )
                    or self.bot.get_channel(
                        ticket_id
                    )
                )

                if channel is None:
                    logger.debug(
                        "Canal do ticket %s "
                        "não foi encontrado.",
                        ticket_id,
                    )
                    continue

                # ─────────────────────────────────
                # FECHAR TICKET
                # ─────────────────────────────────

                try:
                    bot_member = (
                        member.guild.me
                    )

                    if bot_member is None:
                        bot_member = (
                            member.guild.get_member(
                                self.bot.user.id
                            )
                        )

                    await close_ticket(
                        bot=self.bot,
                        channel=channel,
                        closed_by=bot_member,
                        reason=(
                            "O usuário saiu do servidor."
                        ),
                        inter=None,
                    )

                    logger.info(
                        "Ticket %s fechado automaticamente "
                        "porque o usuário %s saiu do servidor.",
                        ticket_id,
                        member.id,
                    )

                except asyncio.CancelledError:
                    raise

                except Exception:
                    logger.exception(
                        "Erro ao fechar automaticamente "
                        "o ticket %s do usuário %s.",
                        ticket_id,
                        member.id,
                    )

    # ═════════════════════════════════════════════════════════
    # LOG DE EXPULSÃO
    # ═════════════════════════════════════════════════════════

    async def _log_kick(
        self,
        member: disnake.Member,
        executor,
        canal_id,
    ) -> None:

        linhas = [
            (
                f"{emoji.member} "
                f"**Alvo:** "
                f"{self._format_user(member)}"
            ),
            (
                f"{emoji.member} "
                f"**Executor:** "
                f"{self._format_user(executor)}"
            ),
        ]

        try:
            await enviar_log(
                member.guild,
                canal_id,
                "Logs de Expulsões",
                linhas,
            )

        except Exception:
            logger.exception(
                "Erro ao enviar log de expulsão "
                "do usuário %s.",
                member.id,
            )

    # ═════════════════════════════════════════════════════════
    # LOG DE SAÍDA
    # ═════════════════════════════════════════════════════════

    async def _log_leave(
        self,
        member: disnake.Member,
        canal_id,
    ) -> None:

        created_timestamp = int(
            member.created_at.timestamp()
        )

        member_count = (
            member.guild.member_count
        )

        if member_count is None:
            member_count = len(
                member.guild.members
            )

        linhas = [
            (
                f"{emoji.member} "
                f"**Membro:** "
                f"{self._format_user(member)}"
            ),
            (
                f"{emoji.calendar} "
                f"**Conta criada:** "
                f"<t:{created_timestamp}:f> "
                f"(<t:{created_timestamp}:R>)"
            ),
            (
                f"{emoji.members} "
                f"**Total de membros:** "
                f"`{member_count}`"
            ),
        ]

        # Mostra quando entrou no servidor,
        # caso a informação esteja disponível.
        if member.joined_at:
            joined_timestamp = int(
                member.joined_at.timestamp()
            )

            linhas.insert(
                2,
                (
                    f"{emoji.calendar} "
                    f"**Entrou no servidor:** "
                    f"<t:{joined_timestamp}:f> "
                    f"(<t:{joined_timestamp}:R>)"
                ),
            )

        try:
            await enviar_log(
                member.guild,
                canal_id,
                "Logs de Saídas",
                linhas,
            )

        except Exception:
            logger.exception(
                "Erro ao enviar log de saída "
                "do usuário %s.",
                member.id,
            )

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_member_remove"
    )
    async def on_member_remove(
        self,
        member: disnake.Member,
    ):
        guild = member.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        # ═════════════════════════════════════════
        # CANAIS
        # ═════════════════════════════════════════

        # CORREÇÃO:
        # antes estava "expusoes".
        canal_expulsoes = obter_canal_id(
            "canal_de_logs_de_expulsoes"
        )

        canal_saidas = obter_canal_id(
            "canal_de_logs_de_saidas"
        )

        # ═════════════════════════════════════════
        # TICKETS
        # ═════════════════════════════════════════

        try:
            await self.auto_close_tickets(
                member
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro inesperado no fechamento "
                "automático de tickets do usuário %s.",
                member.id,
            )

        # Se não existem canais de log,
        # já encerra daqui.
        if (
            not canal_expulsoes
            and not canal_saidas
        ):
            return

        # ═════════════════════════════════════════
        # VERIFICAR KICK
        # ═════════════════════════════════════════

        executor = (
            await self._find_kick_executor(
                member
            )
        )

        # ─────────────────────────────────────────
        # EXPULSÃO
        # ─────────────────────────────────────────

        if executor:
            if canal_expulsoes:
                await self._log_kick(
                    member,
                    executor,
                    canal_expulsoes,
                )

            # Não registra também como saída normal.
            return

        # ─────────────────────────────────────────
        # SAÍDA NORMAL
        # ─────────────────────────────────────────

        if canal_saidas:
            await self._log_leave(
                member,
                canal_saidas,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnMemberRemove(bot)
    )