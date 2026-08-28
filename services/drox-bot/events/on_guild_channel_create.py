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

MAX_TOPIC_LENGTH = 400


class OnGuildChannelCreate(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

    # ═════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════

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
        if value is None:
            return fallback

        value = str(value).strip()

        if not value:
            return fallback

        # Evita quebrar Markdown.
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
    def _channel_type_name(
        channel: disnake.abc.GuildChannel,
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

        if (
            hasattr(disnake, "ForumChannel")
            and isinstance(
                channel,
                disnake.ForumChannel,
            )
        ):
            return "Fórum"

        channel_type = getattr(
            channel,
            "type",
            None,
        )

        type_name = getattr(
            channel_type,
            "name",
            None,
        )

        if type_name:
            return (
                str(type_name)
                .replace("_", " ")
                .title()
            )

        return (
            str(channel_type)
            if channel_type is not None
            else "Desconhecido"
        )

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
            return f"{seconds}s"

        minutes, remaining = divmod(
            seconds,
            60,
        )

        if remaining:
            return (
                f"{minutes}m {remaining}s"
            )

        return f"{minutes}m"

    async def _find_executor(
        self,
        channel: disnake.abc.GuildChannel,
    ):
        """
        Procura quem criou o canal no Audit Log.
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
                            disnake.AuditLogAction.channel_create,
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
                logger.warning(
                    "Sem permissão para consultar "
                    "Audit Log no servidor %s.",
                    channel.guild.id,
                )
                return None

            except disnake.HTTPException:
                logger.debug(
                    "Erro HTTP ao consultar Audit Log "
                    "de criação de canal.",
                    exc_info=True,
                )

            except asyncio.CancelledError:
                raise

            except Exception:
                logger.exception(
                    "Erro ao localizar executor "
                    "da criação do canal %s.",
                    channel.id,
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

    # ═════════════════════════════════════════════
    # EVENTO
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_guild_channel_create"
    )
    async def on_guild_channel_create(
        self,
        channel: disnake.abc.GuildChannel,
    ):
        guild = channel.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        canal_id = obter_canal_id(
            "canal_de_logs_de_canais_criados"
        )

        if not canal_id:
            return

        # ═════════════════════════════════════════
        # EXECUTOR
        # ═════════════════════════════════════════

        executor = await self._find_executor(
            channel
        )

        executor_text = (
            self._format_executor(
                executor
            )
        )

        # ═════════════════════════════════════════
        # DADOS BÁSICOS
        # ═════════════════════════════════════════

        channel_type = (
            self._channel_type_name(
                channel
            )
        )

        channel_mention = getattr(
            channel,
            "mention",
            f"#{channel.name}",
        )

        category = getattr(
            channel,
            "category",
            None,
        )

        if category:
            category_text = (
                f"{category.mention} "
                f"(`{category.id}`)"
            )
        else:
            category_text = "`Sem categoria`"

        position = getattr(
            channel,
            "position",
            None,
        )

        linhas = [
            (
                f"{emoji.textc} "
                f"**Canal criado:** "
                f"{channel_mention} "
                f"(`{channel.id}`)"
            ),

            (
                f"{emoji.textc} "
                f"**Tipo:** "
                f"`{channel_type}`"
            ),

            (
                f"{emoji.dir} "
                f"**Categoria:** "
                f"{category_text}"
            ),
        ]

        if position is not None:
            linhas.append(
                f"{emoji.route} "
                f"**Posição:** "
                f"`{position}`"
            )

        # ═════════════════════════════════════════
        # TÓPICO
        # ═════════════════════════════════════════

        topic = getattr(
            channel,
            "topic",
            None,
        )

        if topic:
            linhas.append(
                f"{emoji.textc} "
                f"**Tópico:** "
                f"`{self._safe_text(topic)}`"
            )

        # ═════════════════════════════════════════
        # NSFW
        # ═════════════════════════════════════════

        nsfw = getattr(
            channel,
            "nsfw",
            None,
        )

        if nsfw is not None:
            linhas.append(
                f"{emoji.warn} "
                f"**NSFW:** "
                f"{self._format_bool(nsfw)}"
            )

        # ═════════════════════════════════════════
        # MODO LENTO
        # ═════════════════════════════════════════

        slowmode = getattr(
            channel,
            "slowmode_delay",
            None,
        )

        if slowmode is not None:
            linhas.append(
                f"{emoji.clock} "
                f"**Modo lento:** "
                f"`{self._format_seconds(slowmode)}`"
            )

        # ═════════════════════════════════════════
        # CANAL DE VOZ / PALCO
        # ═════════════════════════════════════════

        bitrate = getattr(
            channel,
            "bitrate",
            None,
        )

        if bitrate is not None:
            linhas.append(
                f"{emoji.textc} "
                f"**Bitrate:** "
                f"`{bitrate // 1000} kbps`"
            )

        user_limit = getattr(
            channel,
            "user_limit",
            None,
        )

        if user_limit is not None:
            limit_text = (
                str(user_limit)
                if user_limit
                else "Ilimitado"
            )

            linhas.append(
                f"{emoji.members} "
                f"**Limite de usuários:** "
                f"`{limit_text}`"
            )

        # ═════════════════════════════════════════
        # ARQUIVAMENTO
        # ═════════════════════════════════════════

        archive_duration = getattr(
            channel,
            "default_auto_archive_duration",
            None,
        )

        if archive_duration is not None:
            linhas.append(
                f"{emoji.clock} "
                f"**Arquivamento automático:** "
                f"`{archive_duration} min`"
            )

        # ═════════════════════════════════════════
        # EXECUTOR
        # ═════════════════════════════════════════

        linhas.append(
            f"{emoji.member} "
            f"**Executor:** "
            f"{executor_text}"
        )

        # ═════════════════════════════════════════
        # ENVIAR
        # ═════════════════════════════════════════

        try:
            await enviar_log(
                guild,
                canal_id,
                "Logs de Canais - Criados",
                linhas,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro ao enviar log de criação "
                "do canal %s no servidor %s.",
                channel.id,
                guild.id,
            )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnGuildChannelCreate(bot)
    )