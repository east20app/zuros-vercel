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

MAX_TOPIC_LENGTH = 350


class OnGuildChannelUpdate(commands.Cog):
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
    def _safe_text(
        value,
        *,
        fallback: str = "Nenhum",
        limit: int = MAX_TOPIC_LENGTH,
    ) -> str:
        """
        Prepara textos para o log sem deixar
        conteúdo excessivamente grande.
        """

        if value is None:
            return fallback

        value = str(value).strip()

        if not value:
            return fallback

        value = value.replace(
            "`",
            "ˋ",
        )

        if len(value) > limit:
            value = (
                value[:limit - 3]
                + "..."
            )

        return value

    @staticmethod
    def _format_seconds(
        seconds: int,
    ) -> str:
        seconds = int(
            seconds or 0
        )

        if seconds <= 0:
            return "Desativado"

        if seconds < 60:
            return (
                f"{seconds}s"
            )

        minutes, remaining = divmod(
            seconds,
            60,
        )

        if remaining:
            return (
                f"{minutes}m {remaining}s"
            )

        return (
            f"{minutes}m"
        )

    @staticmethod
    def _channel_type_name(
        channel,
    ) -> str:
        if isinstance(
            channel,
            disnake.TextChannel,
        ):
            return "Texto"

        if isinstance(
            channel,
            disnake.VoiceChannel,
        ):
            return "Voz"

        if isinstance(
            channel,
            disnake.StageChannel,
        ):
            return "Palco"

        if isinstance(
            channel,
            disnake.CategoryChannel,
        ):
            return "Categoria"

        if hasattr(
            disnake,
            "ForumChannel",
        ) and isinstance(
            channel,
            disnake.ForumChannel,
        ):
            return "Fórum"

        return str(
            getattr(
                channel,
                "type",
                "Desconhecido",
            )
        )

    async def _find_executor(
        self,
        channel,
    ):
        """
        Localiza quem alterou o canal pelo Audit Log.
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
                        channel.guild,
                        [
                            disnake.AuditLogAction.channel_update,
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
                            == channel.id
                        ),
                        max_age_seconds=(
                            AUDIT_MAX_AGE
                        ),
                    )
                )

                if executor is not None:
                    return executor

            except disnake.Forbidden:
                return None

            except disnake.HTTPException:
                logger.debug(
                    "Erro HTTP ao consultar Audit Log "
                    "de edição de canal.",
                    exc_info=True,
                )

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "Erro ao localizar executor "
                    "da edição do canal %s.",
                    channel.id,
                )
                return None

            if attempt < AUDIT_RETRIES - 1:
                await asyncio.sleep(
                    AUDIT_RETRY_DELAY
                )

        return None

    # ═════════════════════════════════════════════════════════
    # DETECTAR ALTERAÇÕES
    # ═════════════════════════════════════════════════════════

    def _get_changes(
        self,
        before,
        after,
    ) -> list[str]:
        changes = []

        # ─────────────────────────────────────────
        # NOME
        # ─────────────────────────────────────────

        if before.name != after.name:
            changes.append(
                f"{emoji.edit} "
                f"**Nome:** "
                f"`{self._safe_text(before.name)}` "
                f"→ "
                f"`{self._safe_text(after.name)}`"
            )

        # ─────────────────────────────────────────
        # TÓPICO
        # ─────────────────────────────────────────

        before_topic = getattr(
            before,
            "topic",
            None,
        )

        after_topic = getattr(
            after,
            "topic",
            None,
        )

        if before_topic != after_topic:
            changes.append(
                f"{emoji.edit} "
                f"**Tópico:**\n"
                f"Antes: `{self._safe_text(before_topic)}`\n"
                f"Agora: `{self._safe_text(after_topic)}`"
            )

        # ─────────────────────────────────────────
        # MODO LENTO
        # ─────────────────────────────────────────

        before_slowmode = getattr(
            before,
            "slowmode_delay",
            None,
        )

        after_slowmode = getattr(
            after,
            "slowmode_delay",
            None,
        )

        if (
            before_slowmode is not None
            and after_slowmode is not None
            and before_slowmode
            != after_slowmode
        ):
            changes.append(
                f"{emoji.clock} "
                f"**Modo lento:** "
                f"`{self._format_seconds(before_slowmode)}` "
                f"→ "
                f"`{self._format_seconds(after_slowmode)}`"
            )

        # ─────────────────────────────────────────
        # NSFW
        # ─────────────────────────────────────────

        before_nsfw = getattr(
            before,
            "nsfw",
            None,
        )

        after_nsfw = getattr(
            after,
            "nsfw",
            None,
        )

        if (
            before_nsfw is not None
            and after_nsfw is not None
            and before_nsfw
            != after_nsfw
        ):
            changes.append(
                f"{emoji.warn} "
                f"**NSFW:** "
                f"{self._format_bool(before_nsfw)} "
                f"→ "
                f"{self._format_bool(after_nsfw)}"
            )

        # ─────────────────────────────────────────
        # CATEGORIA
        # ─────────────────────────────────────────

        before_category = getattr(
            before,
            "category",
            None,
        )

        after_category = getattr(
            after,
            "category",
            None,
        )

        before_category_id = getattr(
            before_category,
            "id",
            None,
        )

        after_category_id = getattr(
            after_category,
            "id",
            None,
        )

        if (
            before_category_id
            != after_category_id
        ):
            before_name = (
                before_category.name
                if before_category
                else "Nenhuma"
            )

            after_name = (
                after_category.name
                if after_category
                else "Nenhuma"
            )

            changes.append(
                f"{emoji.folder} "
                f"**Categoria:** "
                f"`{self._safe_text(before_name)}` "
                f"→ "
                f"`{self._safe_text(after_name)}`"
            )

        # ─────────────────────────────────────────
        # POSIÇÃO
        # ─────────────────────────────────────────

        before_position = getattr(
            before,
            "position",
            None,
        )

        after_position = getattr(
            after,
            "position",
            None,
        )

        if (
            before_position is not None
            and after_position is not None
            and before_position
            != after_position
        ):
            changes.append(
                f"{emoji.arrow} "
                f"**Posição:** "
                f"`{before_position}` "
                f"→ "
                f"`{after_position}`"
            )

        # ═════════════════════════════════════════
        # CANAIS DE VOZ / PALCO
        # ═════════════════════════════════════════

        before_bitrate = getattr(
            before,
            "bitrate",
            None,
        )

        after_bitrate = getattr(
            after,
            "bitrate",
            None,
        )

        if (
            before_bitrate is not None
            and after_bitrate is not None
            and before_bitrate
            != after_bitrate
        ):
            changes.append(
                f"{emoji.edit} "
                f"**Bitrate:** "
                f"`{before_bitrate // 1000} kbps` "
                f"→ "
                f"`{after_bitrate // 1000} kbps`"
            )

        before_limit = getattr(
            before,
            "user_limit",
            None,
        )

        after_limit = getattr(
            after,
            "user_limit",
            None,
        )

        if (
            before_limit is not None
            and after_limit is not None
            and before_limit
            != after_limit
        ):
            before_limit_text = (
                str(before_limit)
                if before_limit
                else "Ilimitado"
            )

            after_limit_text = (
                str(after_limit)
                if after_limit
                else "Ilimitado"
            )

            changes.append(
                f"{emoji.members} "
                f"**Limite de usuários:** "
                f"`{before_limit_text}` "
                f"→ "
                f"`{after_limit_text}`"
            )

        # ═════════════════════════════════════════
        # AUTO ARCHIVE
        # ═════════════════════════════════════════

        before_archive = getattr(
            before,
            "default_auto_archive_duration",
            None,
        )

        after_archive = getattr(
            after,
            "default_auto_archive_duration",
            None,
        )

        if (
            before_archive is not None
            and after_archive is not None
            and before_archive
            != after_archive
        ):
            changes.append(
                f"{emoji.clock} "
                f"**Arquivamento automático:** "
                f"`{before_archive} min` "
                f"→ "
                f"`{after_archive} min`"
            )

        return changes

    # ═════════════════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════════════════

    @commands.Cog.listener(
        "on_guild_channel_update"
    )
    async def on_guild_channel_update(
        self,
        before: disnake.abc.GuildChannel,
        after: disnake.abc.GuildChannel,
    ):
        guild = after.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        canal_id = obter_canal_id(
            "canal_de_logs_de_canais_editados"
        )

        if not canal_id:
            return

        # ═════════════════════════════════════════
        # ALTERAÇÕES
        # ═════════════════════════════════════════

        changes = self._get_changes(
            before,
            after,
        )

        # Alteração pode ter sido somente em
        # overwrites/permissões. Outro listener
        # deve registrar isso.
        if not changes:
            return

        # ═════════════════════════════════════════
        # EXECUTOR
        # ═════════════════════════════════════════

        executor = await self._find_executor(
            after
        )

        executor_text = (
            self._format_executor(
                executor
            )
        )

        # ═════════════════════════════════════════
        # CANAL
        # ═════════════════════════════════════════

        channel_mention = getattr(
            after,
            "mention",
            f"#{after.name}",
        )

        channel_type = (
            self._channel_type_name(
                after
            )
        )

        linhas = [
            (
                f"{emoji.textc} "
                f"**Canal:** "
                f"{channel_mention} "
                f"(`{after.id}`)"
            ),

            (
                f"{emoji.textc} "
                f"**Tipo:** "
                f"`{channel_type}`"
            ),

            (
                f"{emoji.member} "
                f"**Executor:** "
                f"{executor_text}"
            ),

            "",

            "**Alterações:**",
        ]

        linhas.extend(
            changes
        )

        # ═════════════════════════════════════════
        # ENVIAR
        # ═════════════════════════════════════════

        try:
            await enviar_log(
                guild,
                canal_id,
                "Logs de Canais - Editados",
                linhas,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro ao enviar log de edição "
                "do canal %s no servidor %s.",
                after.id,
                guild.id,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnGuildChannelUpdate(bot)
    )