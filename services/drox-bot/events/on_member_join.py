import logging
from datetime import datetime, timezone

import disnake
from disnake.ext import commands

from ._common import (
    obter_canal_id,
    enviar_log,
    verificar_guild,
)
from functions.emoji import emoji


logger = logging.getLogger(__name__)


class OnMemberJoin(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _format_member(
        member: disnake.Member,
    ) -> str:
        """
        Formata o membro com menção e ID.
        """

        mention = getattr(
            member,
            "mention",
            str(member),
        )

        return (
            f"{mention} "
            f"(`{member.id}`)"
        )

    @staticmethod
    def _get_member_count(
        guild: disnake.Guild,
    ) -> int:
        """
        Retorna a quantidade de membros do servidor.
        """

        if guild.member_count is not None:
            return guild.member_count

        return len(
            guild.members
        )

    @staticmethod
    def _account_age_days(
        member: disnake.Member,
    ) -> int:
        """
        Calcula a idade da conta em dias.
        """

        created_at = member.created_at

        if created_at.tzinfo is None:
            created_at = created_at.replace(
                tzinfo=timezone.utc
            )

        now = datetime.now(
            timezone.utc
        )

        delta = now - created_at

        return max(
            0,
            delta.days,
        )

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_member_join"
    )
    async def on_member_join(
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

        canal_id = obter_canal_id(
            "canal_de_logs_de_entradas"
        )

        if not canal_id:
            return

        # ═════════════════════════════════════════
        # DADOS
        # ═════════════════════════════════════════

        created_timestamp = int(
            member.created_at.timestamp()
        )

        member_count = (
            self._get_member_count(
                guild
            )
        )

        account_age = (
            self._account_age_days(
                member
            )
        )

        # ═════════════════════════════════════════
        # LOG
        # ═════════════════════════════════════════

        linhas = [
            (
                f"{emoji.member} "
                f"**Membro:** "
                f"{self._format_member(member)}"
            ),

            (
                f"{emoji.calendar} "
                f"**Conta criada:** "
                f"<t:{created_timestamp}:f> "
                f"(<t:{created_timestamp}:R>)"
            ),

            (
                f"{emoji.clock} "
                f"**Idade da conta:** "
                f"`{account_age}` "
                f"dia{'s' if account_age != 1 else ''}"
            ),

            (
                f"{emoji.members} "
                f"**Total de membros:** "
                f"`{member_count}`"
            ),
        ]

        # ═════════════════════════════════════════
        # BOT
        # ═════════════════════════════════════════

        if member.bot:
            linhas.append(
                f"{emoji.member} "
                "**Tipo:** `Bot`"
            )
        else:
            linhas.append(
                f"{emoji.member} "
                "**Tipo:** `Usuário`"
            )

        # ═════════════════════════════════════════
        # ENVIAR
        # ═════════════════════════════════════════

        try:
            await enviar_log(
                guild,
                canal_id,
                "Logs de Entradas",
                linhas,
            )

        except Exception:
            logger.exception(
                "Erro ao enviar log de entrada "
                "do usuário %s no servidor %s.",
                member.id,
                guild.id,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnMemberJoin(bot)
    )