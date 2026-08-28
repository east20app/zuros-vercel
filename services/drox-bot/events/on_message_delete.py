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


MAX_CONTENT_PREVIEW = 1500
MAX_ATTACHMENTS_PREVIEW = 5

AUDIT_INITIAL_DELAY = 0.7
AUDIT_RETRIES = 3
AUDIT_RETRY_DELAY = 0.7
AUDIT_MAX_AGE = 30


class OnMessageDelete(commands.Cog):
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
        Impede que ``` dentro da mensagem
        quebre o bloco de código do log.
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
        Prepara o conteúdo da mensagem para o log.
        """

        content = str(
            content or ""
        ).strip()

        if not content:
            return "(sem conteúdo textual)"

        content = cls._sanitize_codeblock(
            content
        )

        if len(content) > MAX_CONTENT_PREVIEW:
            content = (
                content[
                    :MAX_CONTENT_PREVIEW - 3
                ]
                + "..."
            )

        return content

    @staticmethod
    def _channel_id_from_audit(
        entry: disnake.AuditLogEntry,
    ) -> int | None:
        """
        Obtém o ID do canal registrado
        no extra do Audit Log.
        """

        try:
            extra = getattr(
                entry,
                "extra",
                None,
            )

            if extra is None:
                return None

            channel = getattr(
                extra,
                "channel",
                None,
            )

            if channel is not None:
                return getattr(
                    channel,
                    "id",
                    None,
                )

            channel_id = getattr(
                extra,
                "channel_id",
                None,
            )

            if channel_id is None:
                return None

            return int(
                channel_id
            )

        except (
            TypeError,
            ValueError,
            AttributeError,
        ):
            return None

    @classmethod
    def _build_audit_matcher(
        cls,
        deleted_message: disnake.Message,
    ):
        """
        Cria o matcher usado para localizar
        a exclusão no Audit Log.
        """

        author_id = (
            deleted_message.author.id
        )

        channel_id = (
            deleted_message.channel.id
        )

        def matcher(
            entry: disnake.AuditLogEntry,
        ) -> bool:
            try:
                # ─────────────────────────────────
                # DELETE NORMAL
                # ─────────────────────────────────

                if (
                    entry.action
                    == disnake.AuditLogAction.message_delete
                ):
                    target = getattr(
                        entry,
                        "target",
                        None,
                    )

                    target_id = getattr(
                        target,
                        "id",
                        None,
                    )

                    # Normalmente o target é o autor
                    # da mensagem apagada.
                    if target_id != author_id:
                        return False

                    audit_channel_id = (
                        cls._channel_id_from_audit(
                            entry
                        )
                    )

                    # Algumas versões/entradas podem
                    # não fornecer o canal.
                    return (
                        audit_channel_id is None
                        or audit_channel_id
                        == channel_id
                    )

                # ─────────────────────────────────
                # BULK DELETE
                # ─────────────────────────────────

                if (
                    entry.action
                    == disnake.AuditLogAction.message_bulk_delete
                ):
                    audit_channel_id = (
                        cls._channel_id_from_audit(
                            entry
                        )
                    )

                    return (
                        audit_channel_id
                        == channel_id
                    )

            except Exception:
                return False

            return False

        return matcher

    async def _find_executor(
        self,
        deleted_message: disnake.Message,
    ):
        """
        Tenta localizar o executor pelo Audit Log.

        O Audit Log pode demorar alguns instantes
        para ser atualizado pelo Discord.
        """

        await asyncio.sleep(
            AUDIT_INITIAL_DELAY
        )

        matcher = (
            self._build_audit_matcher(
                deleted_message
            )
        )

        for attempt in range(
            AUDIT_RETRIES
        ):
            try:
                executor = (
                    await buscar_executor_auditlog(
                        deleted_message.guild,
                        [
                            disnake.AuditLogAction.message_delete,
                            disnake.AuditLogAction.message_bulk_delete,
                        ],
                        matcher,
                        max_age_seconds=(
                            AUDIT_MAX_AGE
                        ),
                    )
                )

                if executor:
                    return executor

            except disnake.Forbidden:
                # Bot não possui permissão
                # para visualizar Audit Log.
                return None

            except disnake.HTTPException:
                logger.debug(
                    "Erro HTTP consultando Audit Log "
                    "de mensagem deletada.",
                    exc_info=True,
                )

            except Exception:
                logger.exception(
                    "Erro consultando executor "
                    "de mensagem deletada."
                )

                return None

            if (
                attempt
                < AUDIT_RETRIES - 1
            ):
                await asyncio.sleep(
                    AUDIT_RETRY_DELAY
                )

        return None

    @staticmethod
    def _format_executor(
        executor,
    ) -> str:
        """
        Formata o executor encontrado.
        """

        if executor is None:
            return (
                "`Não identificado` "
                "-# Sem registro correspondente "
                "no Audit Log."
            )

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
    def _format_attachments(
        deleted_message: disnake.Message,
    ) -> str | None:
        """
        Mostra os anexos presentes na mensagem apagada.
        """

        attachments = list(
            deleted_message.attachments
            or []
        )

        if not attachments:
            return None

        linhas = []

        for attachment in attachments[
            :MAX_ATTACHMENTS_PREVIEW
        ]:
            filename = (
                attachment.filename
                or "arquivo"
            )

            linhas.append(
                f"{emoji.arrow} "
                f"`{filename}`"
            )

        restante = (
            len(attachments)
            - MAX_ATTACHMENTS_PREVIEW
        )

        if restante > 0:
            linhas.append(
                f"{emoji.arrow} "
                f"... e mais `{restante}` "
                f"arquivo{'s' if restante != 1 else ''}"
            )

        return "\n".join(
            linhas
        )

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_message_delete"
    )
    async def on_message_delete(
        self,
        deleted_message: disnake.Message,
    ):
        guild = deleted_message.guild

        # ─────────────────────────────────────────
        # FILTROS
        # ─────────────────────────────────────────

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        # Mantém seu comportamento atual:
        # não registrar mensagens de bots/webhooks.
        if deleted_message.author.bot:
            return

        if deleted_message.webhook_id:
            return

        canal_logs_id = obter_canal_id(
            "canal_de_logs_de_mensagens"
        )

        if not canal_logs_id:
            return

        # Evita loop caso o próprio canal
        # de logs esteja sendo limpo.
        try:
            if (
                int(canal_logs_id)
                == deleted_message.channel.id
            ):
                return

        except (
            TypeError,
            ValueError,
        ):
            pass

        # ═════════════════════════════════════════
        # EXECUTOR
        # ═════════════════════════════════════════

        executor = await self._find_executor(
            deleted_message
        )

        executor_text = (
            self._format_executor(
                executor
            )
        )

        # ═════════════════════════════════════════
        # MENSAGEM
        # ═════════════════════════════════════════

        content = self._format_content(
            deleted_message.content
        )

        author = (
            deleted_message.author
        )

        author_mention = getattr(
            author,
            "mention",
            str(author),
        )

        author_id = getattr(
            author,
            "id",
            "desconhecido",
        )

        channel = (
            deleted_message.channel
        )

        channel_mention = getattr(
            channel,
            "mention",
            f"#{getattr(channel, 'name', 'desconhecido')}",
        )

        channel_id = getattr(
            channel,
            "id",
            "desconhecido",
        )

        # ═════════════════════════════════════════
        # LINHAS
        # ═════════════════════════════════════════

        linhas = [
            (
                f"{emoji.message} "
                f"**Mensagem deletada em:** "
                f"{channel_mention} "
                f"(`{channel_id}`)"
            ),

            (
                f"{emoji.member} "
                f"**Executor:** "
                f"{executor_text}"
            ),

            (
                f"{emoji.member} "
                f"**Autor:** "
                f"{author_mention} "
                f"(`{author_id}`)"
            ),

            (
                f"{emoji.textc} "
                f"**ID da mensagem:** "
                f"`{deleted_message.id}`"
            ),

            (
                f"{emoji.textc} "
                f"**Conteúdo:**\n"
                f"```text\n"
                f"{content}\n"
                f"```"
            ),
        ]

        # ═════════════════════════════════════════
        # ANEXOS
        # ═════════════════════════════════════════

        attachments = (
            self._format_attachments(
                deleted_message
            )
        )

        if attachments:
            linhas.append(
                f"{emoji.textc} "
                f"**Anexos:**\n"
                f"{attachments}"
            )

        # ═════════════════════════════════════════
        # ENVIAR
        # ═════════════════════════════════════════

        try:
            await enviar_log(
                guild,
                canal_logs_id,
                "Logs de Mensagens - Deletadas",
                linhas,
            )

        except Exception:
            logger.exception(
                "Erro ao enviar log de mensagem "
                "deletada no servidor %s.",
                guild.id,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnMessageDelete(bot)
    )