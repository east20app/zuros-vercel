import asyncio
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
from functions.database import database as db


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# HELPERS DE COMANDO
# ═════════════════════════════════════════════════════════════


def obter_nome_completo_comando(
    inter: disnake.Interaction,
) -> str:
    """
    Retorna o nome completo do slash command.

    Exemplos:
    /painel
        -> painel

    /ticket fechar
        -> ticket fechar

    /config tickets painel editar
        -> config tickets painel editar
    """

    data = getattr(
        inter,
        "data",
        None,
    )

    if not data:
        return ""

    # Primeiro tenta usar qualified_name caso
    # o disnake já tenha resolvido o comando.
    application_command = getattr(
        inter,
        "application_command",
        None,
    )

    qualified_name = getattr(
        application_command,
        "qualified_name",
        None,
    )

    if qualified_name:
        return str(
            qualified_name
        ).strip()

    # ═════════════════════════════════════════════
    # NOME BASE
    # ═════════════════════════════════════════════

    if isinstance(
        data,
        dict,
    ):
        nome_base = str(
            data.get(
                "name",
                "",
            )
            or ""
        )

        options = (
            data.get("options")
            or []
        )

    else:
        nome_base = str(
            getattr(
                data,
                "name",
                "",
            )
            or ""
        )

        options = (
            getattr(
                data,
                "options",
                None,
            )
            or []
        )

    if not nome_base:
        return ""

    partes = [
        nome_base
    ]

    # ═════════════════════════════════════════════
    # SUBCOMANDOS
    # ═════════════════════════════════════════════

    def extrair_subcomandos(
        current_options,
    ) -> None:
        for option in (
            current_options or []
        ):
            if isinstance(
                option,
                dict,
            ):
                option_type = option.get(
                    "type"
                )

                option_name = option.get(
                    "name",
                    "",
                )

                nested_options = (
                    option.get("options")
                    or []
                )

            else:
                option_type = getattr(
                    option,
                    "type",
                    None,
                )

                option_name = getattr(
                    option,
                    "name",
                    "",
                )

                nested_options = (
                    getattr(
                        option,
                        "options",
                        None,
                    )
                    or []
                )

            # Pode vir como enum.
            option_type = getattr(
                option_type,
                "value",
                option_type,
            )

            # Discord:
            # 1 = sub_command
            # 2 = sub_command_group
            if option_type not in (
                1,
                2,
            ):
                continue

            if option_name:
                partes.append(
                    str(option_name)
                )

            if nested_options:
                extrair_subcomandos(
                    nested_options
                )

            # Só existe um caminho de
            # subcomando utilizado por interação.
            break

    extrair_subcomandos(
        options
    )

    return " ".join(
        partes
    ).strip()


# ═════════════════════════════════════════════════════════════
# COG
# ═════════════════════════════════════════════════════════════


class OnCommand(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

        self._cached_bot_id = None

    # ═════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════

    @staticmethod
    def _format_user(
        user,
    ) -> str:
        if user is None:
            return "`Desconhecido`"

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

    @staticmethod
    def _channel_name(
        channel,
    ) -> str:
        if channel is None:
            return "Desconhecido"

        return str(
            getattr(
                channel,
                "name",
                "Desconhecido",
            )
        )

    @staticmethod
    def _channel_display(
        channel,
    ) -> str:
        if channel is None:
            return "`Desconhecido`"

        mention = getattr(
            channel,
            "mention",
            None,
        )

        channel_id = getattr(
            channel,
            "id",
            None,
        )

        if mention and channel_id:
            return (
                f"{mention} "
                f"(`{channel_id}`)"
            )

        if channel_id:
            return (
                f"`{OnCommand._channel_name(channel)}` "
                f"(`{channel_id}`)"
            )

        return (
            f"`{OnCommand._channel_name(channel)}`"
        )

    def _get_bot_id(
        self,
    ):
        """
        Obtém o ID usado pelo Dashboard.

        O valor fica em cache para não consultar
        config.json em todo comando executado.
        """

        if self._cached_bot_id is not None:
            return self._cached_bot_id

        try:
            config = (
                db.obter(
                    "config.json"
                )
                or {}
            )

            if isinstance(
                config,
                dict,
            ):
                bot_id = config.get(
                    "botID"
                )

                if bot_id:
                    self._cached_bot_id = (
                        bot_id
                    )

                    return bot_id

        except Exception:
            logger.debug(
                "Não foi possível obter botID "
                "do config.json.",
                exc_info=True,
            )

        # Fallback seguro.
        bot_user = getattr(
            self.bot,
            "user",
            None,
        )

        bot_id = getattr(
            bot_user,
            "id",
            None,
        )

        self._cached_bot_id = (
            bot_id
        )

        return bot_id

    # ═════════════════════════════════════════════
    # MONGODB
    # ═════════════════════════════════════════════

    @staticmethod
    def _mongo_insert_sync(
        document: dict,
    ):
        """
        Executa o insert síncrono fora do
        event loop principal.
        """

        from connections.mongo_db import (
            database as mongo_db,
        )

        return mongo_db.auditlogs.insert_one(
            document
        )

    async def _save_dashboard_log(
        self,
        *,
        usuario,
        canal,
        action: str,
    ) -> None:
        """
        Salva o comando no MongoDB do Dashboard.

        Uma falha aqui nunca impede
        o log no Discord.
        """

        try:
            avatar = None

            display_avatar = getattr(
                usuario,
                "display_avatar",
                None,
            )

            if display_avatar:
                avatar_url = getattr(
                    display_avatar,
                    "url",
                    None,
                )

                if avatar_url:
                    avatar = str(
                        avatar_url
                    )

            document = {
                "botId": self._get_bot_id(),

                "action": action,

                "username": str(
                    usuario
                ),

                "userAvatar": avatar,

                "target": None,

                "details": (
                    f"Canal: "
                    f"{self._channel_name(canal)}"
                ),

                "timestamp": datetime.now(
                    timezone.utc
                ),
            }

            # PyMongo é síncrono.
            # Não bloqueia o loop do Discord.
            result = await asyncio.to_thread(
                self._mongo_insert_sync,
                document,
            )

            logger.debug(
                "Audit Log salvo no MongoDB: %s",
                getattr(
                    result,
                    "inserted_id",
                    None,
                ),
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro ao salvar Audit Log "
                "de comando no MongoDB."
            )

    # ═════════════════════════════════════════════
    # DISCORD LOG
    # ═════════════════════════════════════════════

    async def _send_command_log(
        self,
        *,
        guild: disnake.Guild,
        usuario,
        canal,
        comando: str,
        tipo: str,
    ) -> None:
        """
        Envia o registro para o canal de logs.
        """

        canal_logs_id = obter_canal_id(
            "canal_de_logs_de_comandos"
        )

        if not canal_logs_id:
            return

        linhas = [
            (
                f"{emoji.commands} "
                f"**Comando:** "
                f"`{comando}`"
            ),

            (
                f"{emoji.member} "
                f"**Usuário:** "
                f"{self._format_user(usuario)}"
            ),

            (
                f"{emoji.textc} "
                f"**Canal:** "
                f"{self._channel_display(canal)}"
            ),

            (
                f"{emoji.commands} "
                f"**Tipo:** "
                f"`{tipo}`"
            ),
        ]

        try:
            await enviar_log(
                guild,
                canal_logs_id,
                (
                    f"Logs de Comandos - "
                    f"{tipo}"
                ),
                linhas,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro ao enviar log de comando "
                "no servidor %s.",
                guild.id,
            )

    # ═════════════════════════════════════════════
    # PROCESSAR COMANDO
    # ═════════════════════════════════════════════

    async def _process_command(
        self,
        *,
        guild: disnake.Guild,
        usuario,
        canal,
        comando_dashboard: str,
        comando_discord: str,
        tipo: str,
    ) -> None:
        """
        Processa Dashboard + Discord de forma
        independente.
        """

        await asyncio.gather(
            self._save_dashboard_log(
                usuario=usuario,
                canal=canal,
                action=comando_dashboard,
            ),

            self._send_command_log(
                guild=guild,
                usuario=usuario,
                canal=canal,
                comando=comando_discord,
                tipo=tipo,
            ),
        )

    # ═════════════════════════════════════════════
    # SLASH COMMAND
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_interaction"
    )
    async def on_slash_command(
        self,
        inter: disnake.Interaction,
    ):
        # Só queremos Application Commands.
        if (
            inter.type
            != disnake.InteractionType.application_command
        ):
            return

        data = getattr(
            inter,
            "data",
            None,
        )

        if not data:
            return

        command_type = getattr(
            data,
            "type",
            None,
        )

        if isinstance(
            data,
            dict,
        ):
            command_type = data.get(
                "type"
            )

        command_type = getattr(
            command_type,
            "value",
            command_type,
        )

        chat_input_type = getattr(
            disnake.ApplicationCommandType.chat_input,
            "value",
            disnake.ApplicationCommandType.chat_input,
        )

        # Ignora User Commands e Message Commands.
        if command_type != chat_input_type:
            return

        guild = inter.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        usuario = getattr(
            inter,
            "author",
            None,
        ) or getattr(
            inter,
            "user",
            None,
        )

        if usuario is None:
            return

        nome_completo = (
            obter_nome_completo_comando(
                inter
            )
        )

        if not nome_completo:
            return

        comando = (
            f"/{nome_completo}"
        )

        await self._process_command(
            guild=guild,
            usuario=usuario,
            canal=inter.channel,
            comando_dashboard=(
                f"Usou comando {comando}"
            ),
            comando_discord=comando,
            tipo="Slash",
        )

    # ═════════════════════════════════════════════
    # PREFIX COMMAND
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_command"
    )
    async def on_prefix_command(
        self,
        ctx: commands.Context,
    ):
        guild = ctx.guild

        if guild is None:
            return

        if not verificar_guild(
            guild.id
        ):
            return

        if ctx.command is None:
            return

        usuario = ctx.author

        # qualified_name também captura
        # grupos/subcomandos.
        nome = getattr(
            ctx.command,
            "qualified_name",
            None,
        )

        if not nome:
            nome = getattr(
                ctx.command,
                "name",
                "desconhecido",
            )

        prefix = str(
            ctx.prefix
            or ""
        )

        comando = (
            f"{prefix}{nome}"
        )

        await self._process_command(
            guild=guild,
            usuario=usuario,
            canal=ctx.channel,
            comando_dashboard=(
                f"Usou comando {comando}"
            ),
            comando_discord=comando,
            tipo="Prefixo",
        )


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        OnCommand(bot)
    )