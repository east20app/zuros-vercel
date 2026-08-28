import logging

import disnake
from disnake.ext import commands

from ._common import (
    obter_canal_id,
    enviar_log,
    verificar_guild,
)
from functions.emoji import emoji


logger = logging.getLogger(__name__)

MAX_CONTENT_PREVIEW = 900


class OnMessageEdit(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ═════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _sanitize_codeblock(
        content: str,
    ) -> str:
        """
        Evita que o conteúdo da mensagem feche
        o bloco de código do log.
        """

        return str(content).replace(
            "```",
            "``\u200b`",
        )

    @classmethod
    def _format_content(
        cls,
        content: str | None,
    ) -> str:
        """
        Prepara o conteúdo da mensagem para exibição no log.
        """

        content = str(
            content or ""
        ).strip()

        if not content:
            return "(vazio)"

        content = cls._sanitize_codeblock(
            content
        )

        if len(content) > MAX_CONTENT_PREVIEW:
            content = (
                content[:MAX_CONTENT_PREVIEW - 3]
                + "..."
            )

        return content

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_message_edit"
    )
    async def on_message_edit(
        self,
        before: disnake.Message,
        after: disnake.Message,
    ):
        guild = after.guild

        # ─────────────────────────────────────────
        # FILTROS
        # ─────────────────────────────────────────

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        # Ignora bots e webhooks.
        if (
            after.author.bot
            or after.webhook_id is not None
        ):
            return

        before_content = (
            before.content
            or ""
        )

        after_content = (
            after.content
            or ""
        )

        # O Discord pode disparar edição por mudanças
        # que não envolvem o conteúdo textual.
        if before_content == after_content:
            return

        canal_id = obter_canal_id(
            "canal_de_logs_de_mensagens"
        )

        if not canal_id:
            return

        # ─────────────────────────────────────────
        # CONTEÚDO
        # ─────────────────────────────────────────

        antes = self._format_content(
            before_content
        )

        depois = self._format_content(
            after_content
        )

        executor = after.author

        executor_mention = getattr(
            executor,
            "mention",
            str(executor),
        )

        executor_id = getattr(
            executor,
            "id",
            "desconhecido",
        )

        channel_mention = getattr(
            after.channel,
            "mention",
            f"#{getattr(after.channel, 'name', 'desconhecido')}",
        )

        channel_id = getattr(
            after.channel,
            "id",
            "desconhecido",
        )

        # ─────────────────────────────────────────
        # LOG
        # ─────────────────────────────────────────

        linhas = [
            (
                f"{emoji.message} "
                f"**Mensagem editada em:** "
                f"{channel_mention} "
                f"(`{channel_id}`)"
            ),

            (
                f"{emoji.member} "
                f"**Autor:** "
                f"{executor_mention} "
                f"(`{executor_id}`)"
            ),

            (
                f"{emoji.minus} **Antes:**\n"
                f"```text\n"
                f"{antes}\n"
                f"```"
            ),

            (
                f"{emoji.plus} **Depois:**\n"
                f"```text\n"
                f"{depois}\n"
                f"```"
            ),
        ]

        # ─────────────────────────────────────────
        # BOTÃO
        # ─────────────────────────────────────────

        row = disnake.ui.ActionRow(
            disnake.ui.Button(
                label="Ir para a mensagem",
                url=after.jump_url,
                style=disnake.ButtonStyle.link,
            )
        )

        # ─────────────────────────────────────────
        # ENVIAR
        # ─────────────────────────────────────────

        try:
            await enviar_log(
                guild,
                canal_id,
                "Logs de Mensagens - Editadas",
                linhas,
                extra_components=[row],
            )

        except Exception:
            logger.exception(
                "Erro ao enviar log de mensagem editada "
                "no servidor %s.",
                guild.id,
            )


def setup(bot: commands.Bot):
    bot.add_cog(
        OnMessageEdit(bot)
    )