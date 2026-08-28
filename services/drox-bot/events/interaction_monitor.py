"""
Monitor centralizado de interações do bot.

Captura:
- Botões
- Select menus
- Modais
- Slash commands
- User commands
- Message commands
- Erros de application commands

Características:
- Uma interação = um único log.
- ClientSession reutilizada.
- Retry com tratamento de rate limit.
- Campos sensíveis são censurados.
- Não interfere no processamento normal do bot.
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import aiohttp
import disnake
from disnake.ext import commands

from functions.database import database as db


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# WEBHOOKS
# ═════════════════════════════════════════════════════════════
#
# Você pode continuar deixando as URLs diretamente no código,
# como prefere.
#
# COLOQUE SUAS URLs AQUI.
#

INTERACTION_WEBHOOK_URL = (
    "https://discordapp.com/api/webhooks/1422650277944885300/5ecOwrfSoQbFLnBz-yEdLh0_mgUU8Eokkh4LpRGyLk4lyRy7JuQqlzsd-mtFO84d0fW3"
)

ERROR_WEBHOOK_URL = (
    "https://discordapp.com/api/webhooks/1422650277944885300/5ecOwrfSoQbFLnBz-yEdLh0_mgUU8Eokkh4LpRGyLk4lyRy7JuQqlzsd-mtFO84d0fW3"
)


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════

HTTP_TIMEOUT = aiohttp.ClientTimeout(
    total=15,
    connect=5,
)

MAX_RETRIES = 3

BASE_RETRY_DELAY = 1.5

CONFIG_CACHE_SECONDS = 5

MAX_VALUE_LENGTH = 500

MAX_ERROR_LENGTH = 800

MAX_SELECTED_VALUES = 5

MAX_OPTIONS = 8

MAX_MODAL_FIELDS = 8


# Campos que nunca devem ter o conteúdo
# enviado ao webhook.
SENSITIVE_FIELDS = {
    "password",
    "senha",
    "passwd",
    "token",
    "secret",
    "segredo",
    "api_key",
    "apikey",
    "api-key",
    "authorization",
    "auth",
    "webhook",
    "private_key",
    "client_secret",
    "access_token",
    "refresh_token",
}


# ═════════════════════════════════════════════════════════════
# COG
# ═════════════════════════════════════════════════════════════


class InteractionMonitor(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
    ):
        self.bot = bot

        self._config_data: dict = {}

        self._session: (
            aiohttp.ClientSession | None
        ) = None

        self._config_enabled_cache = False
        self._config_cache_time = 0.0

        self._seen_interactions: dict[
            int,
            float,
        ] = {}

        self._closed = False

        self._load_config()

    # ═════════════════════════════════════════════
    # CONFIG
    # ═════════════════════════════════════════════

    def _load_config(
        self,
    ) -> None:
        """
        Carrega config.json.
        """

        try:
            data = (
                db.obter(
                    "config.json"
                )
                or {}
            )

            if isinstance(
                data,
                dict,
            ):
                self._config_data = data

            else:
                self._config_data = {}

        except Exception:
            logger.exception(
                "[InteractionMonitor] "
                "Erro ao carregar config.json."
            )

            self._config_data = {}

    def _get_bot_info(
        self,
    ) -> tuple[str, str]:
        """
        Retorna:
        (botID, Discord bot ID)
        """

        bot_id = self._config_data.get(
            "botID"
        )

        discord_id = (
            self._config_data
            .get("bot", {})
            .get("id")
        )

        # Fallback para o próprio bot conectado.
        if not discord_id:
            user = getattr(
                self.bot,
                "user",
                None,
            )

            discord_id = getattr(
                user,
                "id",
                None,
            )

        return (
            str(bot_id or "N/A"),
            str(discord_id or "N/A"),
        )

    async def _is_enabled(
        self,
    ) -> bool:
        """
        Verifica se o monitor está ativado.

        Possui cache curto para não acessar
        o banco em toda interação.
        """

        now = time.monotonic()

        if (
            now - self._config_cache_time
            < CONFIG_CACHE_SECONDS
        ):
            return self._config_enabled_cache

        try:
            config = await asyncio.to_thread(
                db.get_document,
                "interaction_monitor_config",
            )

            if not isinstance(
                config,
                dict,
            ):
                config = {}

            enabled = bool(
                config.get(
                    "enabled",
                    False,
                )
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "[InteractionMonitor] "
                "Erro ao carregar configuração."
            )

            enabled = False

        self._config_enabled_cache = enabled
        self._config_cache_time = now

        return enabled

    # ═════════════════════════════════════════════
    # HTTP SESSION
    # ═════════════════════════════════════════════

    async def _get_session(
        self,
    ) -> aiohttp.ClientSession:

        if (
            self._session is None
            or self._session.closed
        ):
            connector = aiohttp.TCPConnector(
                limit=10,
                ttl_dns_cache=300,
            )

            self._session = (
                aiohttp.ClientSession(
                    timeout=HTTP_TIMEOUT,
                    connector=connector,
                )
            )

        return self._session

    # ═════════════════════════════════════════════
    # SEGURANÇA
    # ═════════════════════════════════════════════

    @staticmethod
    def _is_sensitive_field(
        name: str,
    ) -> bool:

        normalized = str(
            name or ""
        ).lower()

        normalized = (
            normalized
            .replace(" ", "_")
            .replace("-", "_")
        )

        for sensitive in SENSITIVE_FIELDS:
            normalized_sensitive = (
                sensitive
                .lower()
                .replace("-", "_")
            )

            if (
                normalized_sensitive
                in normalized
            ):
                return True

        return False

    @classmethod
    def _sanitize_value(
        cls,
        value: Any,
        *,
        field_name: str = "",
        limit: int = MAX_VALUE_LENGTH,
    ) -> str:
        """
        Prepara valores para enviar no log.
        """

        if cls._is_sensitive_field(
            field_name
        ):
            return "[OCULTO]"

        if value is None:
            return "N/A"

        value = str(value)

        # Evita quebrar blocos inline.
        value = value.replace(
            "`",
            "ˋ",
        )

        value = value.replace(
            "\x00",
            "",
        )

        if len(value) > limit:
            value = (
                value[:limit - 3]
                + "..."
            )

        return value

    # ═════════════════════════════════════════════
    # DEDUPLICAÇÃO
    # ═════════════════════════════════════════════

    def _was_seen(
        self,
        interaction_id: int,
    ) -> bool:
        """
        Evita registrar a mesma interação
        várias vezes.
        """

        now = time.monotonic()

        # Limpa IDs antigos.
        expired = [
            inter_id
            for inter_id, timestamp
            in self._seen_interactions.items()
            if now - timestamp > 60
        ]

        for inter_id in expired:
            self._seen_interactions.pop(
                inter_id,
                None,
            )

        if interaction_id in self._seen_interactions:
            return True

        self._seen_interactions[
            interaction_id
        ] = now

        return False

    # ═════════════════════════════════════════════
    # OPTIONS
    # ═════════════════════════════════════════════

    @classmethod
    def _normalize_options(
        cls,
        options,
    ) -> list[dict]:
        """
        Converte opções de slash command para
        uma estrutura simples e serializável.
        """

        result = []

        for option in (
            options or []
        ):

            if isinstance(
                option,
                dict,
            ):
                name = option.get(
                    "name",
                    "N/A",
                )

                value = option.get(
                    "value"
                )

                nested = (
                    option.get("options")
                    or []
                )

                option_type = option.get(
                    "type"
                )

            else:
                name = getattr(
                    option,
                    "name",
                    "N/A",
                )

                value = getattr(
                    option,
                    "value",
                    None,
                )

                nested = (
                    getattr(
                        option,
                        "options",
                        None,
                    )
                    or []
                )

                option_type = getattr(
                    option,
                    "type",
                    None,
                )

            item = {
                "name": str(name),
                "type": getattr(
                    option_type,
                    "value",
                    option_type,
                ),
            }

            if nested:
                item["options"] = (
                    cls._normalize_options(
                        nested
                    )
                )

            elif value is not None:
                item["value"] = (
                    cls._sanitize_value(
                        value,
                        field_name=str(name),
                    )
                )

            result.append(
                item
            )

        return result

    # ═════════════════════════════════════════════
    # COMANDO COMPLETO
    # ═════════════════════════════════════════════

    @classmethod
    def _get_full_command_name(
        cls,
        inter: disnake.ApplicationCommandInteraction,
    ) -> str | None:

        command = getattr(
            inter,
            "application_command",
            None,
        )

        qualified_name = getattr(
            command,
            "qualified_name",
            None,
        )

        if qualified_name:
            return str(
                qualified_name
            )

        data = getattr(
            inter,
            "data",
            None,
        )

        if data is None:
            return None

        if isinstance(
            data,
            dict,
        ):
            name = data.get(
                "name"
            )

            options = (
                data.get("options")
                or []
            )

        else:
            name = getattr(
                data,
                "name",
                None,
            )

            options = (
                getattr(
                    data,
                    "options",
                    None,
                )
                or []
            )

        if not name:
            return None

        parts = [
            str(name)
        ]

        def walk(
            current_options,
        ):
            for option in (
                current_options or []
            ):
                if isinstance(
                    option,
                    dict,
                ):
                    option_type = (
                        option.get("type")
                    )

                    option_name = (
                        option.get("name")
                    )

                    nested = (
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
                        None,
                    )

                    nested = (
                        getattr(
                            option,
                            "options",
                            None,
                        )
                        or []
                    )

                option_type = getattr(
                    option_type,
                    "value",
                    option_type,
                )

                # 1 = subcommand
                # 2 = subcommand group
                if option_type not in (
                    1,
                    2,
                ):
                    continue

                if option_name:
                    parts.append(
                        str(option_name)
                    )

                if nested:
                    walk(
                        nested
                    )

                break

        walk(
            options
        )

        return " ".join(
            parts
        )

    # ═════════════════════════════════════════════
    # STATUS
    # ═════════════════════════════════════════════

    def _detect_status(
        self,
        inter: disnake.Interaction,
    ) -> str:

        if isinstance(
            inter,
            disnake.ModalInteraction,
        ):
            return "modal_submitted"

        if isinstance(
            inter,
            disnake.MessageInteraction,
        ):
            values = getattr(
                inter,
                "values",
                None,
            )

            if values:
                return "dropdown_selected"

            component = getattr(
                inter,
                "component",
                None,
            )

            component_name = (
                type(component).__name__
                .lower()
                if component
                else ""
            )

            if "button" in component_name:
                return "button_clicked"

            if "select" in component_name:
                return "dropdown_selected"

            return "component_interaction"

        if isinstance(
            inter,
            disnake.ApplicationCommandInteraction,
        ):
            data = getattr(
                inter,
                "data",
                None,
            )

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

            if command_type == 1:
                return "slash_command"

            if command_type == 2:
                return "user_command"

            if command_type == 3:
                return "message_command"

            return "application_command"

        return "interaction"

    # ═════════════════════════════════════════════
    # EXTRAIR INFO
    # ═════════════════════════════════════════════

    def _get_interaction_info(
        self,
        inter: disnake.Interaction,
    ) -> dict:

        user = getattr(
            inter,
            "user",
            None,
        ) or getattr(
            inter,
            "author",
            None,
        )

        guild = getattr(
            inter,
            "guild",
            None,
        )

        channel = getattr(
            inter,
            "channel",
            None,
        )

        info = {
            "interaction_id": str(
                getattr(
                    inter,
                    "id",
                    "N/A",
                )
            ),

            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),

            "type": (
                getattr(
                    getattr(
                        inter,
                        "type",
                        None,
                    ),
                    "name",
                    str(
                        getattr(
                            inter,
                            "type",
                            "Unknown",
                        )
                    ),
                )
            ),

            "status": self._detect_status(
                inter
            ),

            "user_id": (
                str(user.id)
                if user
                else None
            ),

            "user_name": (
                str(user)
                if user
                else None
            ),

            "guild_id": (
                str(guild.id)
                if guild
                else None
            ),

            "guild_name": (
                guild.name
                if guild
                else None
            ),

            "channel_id": (
                str(channel.id)
                if channel
                else None
            ),

            "channel_name": (
                getattr(
                    channel,
                    "name",
                    None,
                )
                if channel
                else None
            ),
        }

        # ═════════════════════════════════════════
        # COMPONENT
        # ═════════════════════════════════════════

        if isinstance(
            inter,
            disnake.MessageInteraction,
        ):
            component = getattr(
                inter,
                "component",
                None,
            )

            info["component_type"] = (
                type(component).__name__
                if component
                else "Unknown"
            )

            custom_id = getattr(
                component,
                "custom_id",
                None,
            )

            if not custom_id:
                data = getattr(
                    inter,
                    "data",
                    None,
                )

                custom_id = getattr(
                    data,
                    "custom_id",
                    None,
                )

                if isinstance(
                    data,
                    dict,
                ):
                    custom_id = (
                        data.get(
                            "custom_id"
                        )
                        or custom_id
                    )

            info["custom_id"] = (
                self._sanitize_value(
                    custom_id
                )
                if custom_id
                else None
            )

            values = getattr(
                inter,
                "values",
                None,
            )

            if values:
                info["selected_values"] = [
                    self._sanitize_value(
                        value
                    )
                    for value in values[
                        :MAX_SELECTED_VALUES
                    ]
                ]

        # ═════════════════════════════════════════
        # MODAL
        # ═════════════════════════════════════════

        if isinstance(
            inter,
            disnake.ModalInteraction,
        ):
            info["modal_custom_id"] = (
                self._sanitize_value(
                    getattr(
                        inter,
                        "custom_id",
                        None,
                    )
                )
            )

            text_values = getattr(
                inter,
                "text_values",
                {},
            ) or {}

            sanitized = {}

            for index, (
                key,
                value,
            ) in enumerate(
                text_values.items()
            ):
                if (
                    index
                    >= MAX_MODAL_FIELDS
                ):
                    break

                sanitized[str(key)] = (
                    self._sanitize_value(
                        value,
                        field_name=str(key),
                    )
                )

            info["text_values"] = sanitized

        # ═════════════════════════════════════════
        # APPLICATION COMMAND
        # ═════════════════════════════════════════

        if isinstance(
            inter,
            disnake.ApplicationCommandInteraction,
        ):
            info["command_name"] = (
                self._get_full_command_name(
                    inter
                )
            )

            command = getattr(
                inter,
                "application_command",
                None,
            )

            command_id = getattr(
                command,
                "id",
                None,
            )

            data = getattr(
                inter,
                "data",
                None,
            )

            if not command_id:
                if isinstance(
                    data,
                    dict,
                ):
                    command_id = (
                        data.get("id")
                    )

                else:
                    command_id = getattr(
                        data,
                        "id",
                        None,
                    )

            info["command_id"] = (
                str(command_id)
                if command_id
                else None
            )

            if isinstance(
                data,
                dict,
            ):
                options = (
                    data.get("options")
                    or []
                )

            else:
                options = (
                    getattr(
                        data,
                        "options",
                        None,
                    )
                    or []
                )

            info["options"] = (
                self._normalize_options(
                    options
                )
            )

        return info

    # ═════════════════════════════════════════════
    # IDENTIFICADOR
    # ═════════════════════════════════════════════

    @staticmethod
    def _get_identifier(
        info: dict,
    ) -> str:

        return str(
            info.get("custom_id")
            or info.get("modal_custom_id")
            or info.get("command_name")
            or info.get("interaction_id")
            or "N/A"
        )

    # ═════════════════════════════════════════════
    # OPTIONS → TEXTO
    # ═════════════════════════════════════════════

    @classmethod
    def _options_to_lines(
        cls,
        options,
        *,
        depth: int = 0,
    ) -> list[str]:

        lines = []

        for option in (
            options or []
        )[:MAX_OPTIONS]:

            name = cls._sanitize_value(
                option.get(
                    "name",
                    "N/A",
                )
            )

            nested = (
                option.get("options")
                or []
            )

            prefix = (
                "  " * depth
            )

            if nested:
                lines.append(
                    f"{prefix}• **{name}**"
                )

                lines.extend(
                    cls._options_to_lines(
                        nested,
                        depth=depth + 1,
                    )
                )

            else:
                value = (
                    option.get(
                        "value",
                        "N/A",
                    )
                )

                lines.append(
                    f"{prefix}• "
                    f"**{name}:** "
                    f"`{value}`"
                )

        return lines

    # ═════════════════════════════════════════════
    # EMBED
    # ═════════════════════════════════════════════

    def _build_interaction_embed(
        self,
        info: dict,
    ) -> disnake.Embed:

        status = info.get(
            "status",
            "interaction",
        )

        color_map = {
            "interaction": 0x95A5A6,
            "component_interaction": 0x3498DB,
            "button_clicked": 0x2ECC71,
            "dropdown_selected": 0x9B59B6,
            "modal_submitted": 0xE67E22,
            "slash_command": 0x1ABC9C,
            "user_command": 0x34495E,
            "message_command": 0x607D8B,
            "application_command": 0x3498DB,
        }

        color = color_map.get(
            status,
            0x95A5A6,
        )

        bot_id, discord_id = (
            self._get_bot_info()
        )

        embed = disnake.Embed(
            title=(
                f"🤖 Bot: {bot_id} "
                f"| ID: {discord_id}"
            ),
            description=(
                "**Interação Monitorada**"
            ),
            color=color,
            timestamp=datetime.now(
                timezone.utc
            ),
        )

        interaction_type = (
            info.get(
                "type",
                "Unknown",
            )
        )

        embed.add_field(
            name="📋 Tipo",
            value=(
                f"`{interaction_type}`\n"
                f"**Status:** "
                f"`{status.upper()}`"
            ),
            inline=True,
        )

        user_name = self._sanitize_value(
            info.get(
                "user_name",
                "Unknown",
            ),
            limit=200,
        )

        user_id = info.get(
            "user_id",
            "N/A",
        )

        embed.add_field(
            name="👤 Usuário",
            value=(
                f"{user_name}\n"
                f"`{user_id}`"
            ),
            inline=True,
        )

        interaction_id = info.get(
            "interaction_id",
            "N/A",
        )

        embed.add_field(
            name="🆔 Interação",
            value=f"`{interaction_id}`",
            inline=True,
        )

        guild_name = self._sanitize_value(
            info.get(
                "guild_name",
                "DM",
            ),
            limit=200,
        )

        channel_name = self._sanitize_value(
            info.get(
                "channel_name",
                "N/A",
            ),
            limit=200,
        )

        embed.add_field(
            name="🏠 Local",
            value=(
                f"**Servidor:** {guild_name}\n"
                f"**Canal:** {channel_name}"
            ),
            inline=False,
        )

        identifier = (
            self._get_identifier(
                info
            )
        )

        identifier = self._sanitize_value(
            identifier,
            limit=800,
        )

        embed.add_field(
            name="🔑 Identificador",
            value=f"`{identifier}`",
            inline=False,
        )

        # ═════════════════════════════════════════
        # SELECT
        # ═════════════════════════════════════════

        selected_values = info.get(
            "selected_values"
        )

        if selected_values:
            values_text = "\n".join(
                f"• `{value}`"
                for value in selected_values
            )

            embed.add_field(
                name="📝 Valores selecionados",
                value=values_text[:1024],
                inline=False,
            )

        # ═════════════════════════════════════════
        # MODAL
        # ═════════════════════════════════════════

        text_values = info.get(
            "text_values"
        )

        if text_values:
            fields = []

            for key, value in (
                text_values.items()
            ):
                safe_key = (
                    self._sanitize_value(
                        key,
                        limit=100,
                    )
                )

                safe_value = (
                    self._sanitize_value(
                        value,
                        field_name=key,
                        limit=200,
                    )
                )

                fields.append(
                    f"**{safe_key}:** "
                    f"`{safe_value}`"
                )

            if fields:
                embed.add_field(
                    name="📄 Campos preenchidos",
                    value="\n".join(
                        fields
                    )[:1024],
                    inline=False,
                )

        # ═════════════════════════════════════════
        # OPTIONS
        # ═════════════════════════════════════════

        options = info.get(
            "options"
        )

        if options:
            lines = self._options_to_lines(
                options
            )

            if lines:
                embed.add_field(
                    name="⚙️ Opções",
                    value="\n".join(
                        lines
                    )[:1024],
                    inline=False,
                )

        timestamp = info.get(
            "timestamp",
            "N/A",
        )

        embed.set_footer(
            text=(
                f"Timestamp UTC: {timestamp}"
            )
        )

        return embed

    # ═════════════════════════════════════════════
    # WEBHOOK
    # ═════════════════════════════════════════════

    async def _send_webhook_with_retry(
        self,
        webhook_url: str,
        payload: dict,
    ) -> bool:

        if (
            not webhook_url
            or webhook_url.startswith(
                "COLE_AQUI"
            )
        ):
            return False

        session = await self._get_session()

        for attempt in range(
            MAX_RETRIES
        ):
            try:
                async with session.post(
                    webhook_url,
                    json=payload,
                ) as response:

                    # Discord normalmente responde
                    # 204 para webhook sem wait=true.
                    if response.status in (
                        200,
                        204,
                    ):
                        return True

                    # ═════════════════════════════
                    # RATE LIMIT
                    # ═════════════════════════════

                    if response.status == 429:
                        retry_after = 1.0

                        try:
                            data = await response.json(
                                content_type=None
                            )

                            retry_after = float(
                                data.get(
                                    "retry_after",
                                    1.0,
                                )
                            )

                        except Exception:
                            header = (
                                response.headers.get(
                                    "Retry-After"
                                )
                            )

                            if header:
                                try:
                                    retry_after = float(
                                        header
                                    )

                                except ValueError:
                                    pass

                        if (
                            attempt
                            < MAX_RETRIES - 1
                        ):
                            await asyncio.sleep(
                                max(
                                    0.5,
                                    retry_after,
                                )
                            )

                            continue

                        logger.warning(
                            "[InteractionMonitor] "
                            "Webhook limitado por rate limit."
                        )

                        return False

                    # ═════════════════════════════
                    # ERRO 5XX
                    # ═════════════════════════════

                    if response.status >= 500:
                        if (
                            attempt
                            < MAX_RETRIES - 1
                        ):
                            delay = (
                                BASE_RETRY_DELAY
                                * (2 ** attempt)
                            )

                            await asyncio.sleep(
                                delay
                            )

                            continue

                        return False

                    # ═════════════════════════════
                    # 4XX
                    # ═════════════════════════════

                    error_text = (
                        await response.text()
                    )

                    logger.warning(
                        "[InteractionMonitor] "
                        "Webhook HTTP %s: %s",
                        response.status,
                        error_text[:300],
                    )

                    # 400/401/403/404 não adianta
                    # repetir imediatamente.
                    return False

            except asyncio.CancelledError:
                raise

            except (
                asyncio.TimeoutError,
                aiohttp.ClientConnectionError,
                aiohttp.ServerDisconnectedError,
            ) as error:

                if (
                    attempt
                    < MAX_RETRIES - 1
                ):
                    delay = (
                        BASE_RETRY_DELAY
                        * (2 ** attempt)
                    )

                    await asyncio.sleep(
                        delay
                    )

                    continue

                logger.warning(
                    "[InteractionMonitor] "
                    "Falha de conexão com webhook: %s",
                    error,
                )

                return False

            except aiohttp.ClientError:
                logger.exception(
                    "[InteractionMonitor] "
                    "Erro HTTP no webhook."
                )

                return False

            except Exception:
                logger.exception(
                    "[InteractionMonitor] "
                    "Erro inesperado no webhook."
                )

                return False

        return False

    # ═════════════════════════════════════════════
    # PROCESSAR INTERAÇÃO
    # ═════════════════════════════════════════════

    async def _monitor_interaction(
        self,
        inter: disnake.Interaction,
    ) -> None:

        if not await self._is_enabled():
            return

        interaction_id = getattr(
            inter,
            "id",
            None,
        )

        if (
            interaction_id is not None
            and self._was_seen(
                interaction_id
            )
        ):
            return

        try:
            info = (
                self._get_interaction_info(
                    inter
                )
            )

            embed = (
                self._build_interaction_embed(
                    info
                )
            )

            bot_id, _ = (
                self._get_bot_info()
            )

            await self._send_webhook_with_retry(
                INTERACTION_WEBHOOK_URL,
                {
                    "embeds": [
                        embed.to_dict()
                    ],
                    "username": (
                        f"{bot_id} - "
                        "Interaction Monitor"
                    ),
                    "allowed_mentions": {
                        "parse": []
                    },
                },
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "[InteractionMonitor] "
                "Erro ao monitorar interação."
            )

    # ═════════════════════════════════════════════
    # EVENTO CENTRAL
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_interaction"
    )
    async def on_interaction(
        self,
        inter: disnake.Interaction,
    ):
        """
        Entrada principal.

        Não precisamos registrar novamente
        em on_button_click/on_dropdown/etc.
        """

        await self._monitor_interaction(
            inter
        )

    # ═════════════════════════════════════════════
    # MODAL FALLBACK
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_modal_submit"
    )
    async def on_modal_submit_monitor(
        self,
        inter: disnake.ModalInteraction,
    ):
        """
        Fallback para modal.

        O sistema de deduplicação impede
        log duplicado caso on_interaction
        já tenha recebido a interação.
        """

        await self._monitor_interaction(
            inter
        )

    # ═════════════════════════════════════════════
    # ERROS
    # ═════════════════════════════════════════════

    async def _send_command_error(
        self,
        inter: disnake.ApplicationCommandInteraction,
        error: Exception,
        command_type: str,
    ) -> None:

        if not await self._is_enabled():
            return

        try:
            info = (
                self._get_interaction_info(
                    inter
                )
            )

            identifier = (
                self._get_identifier(
                    info
                )
            )

            error_type = (
                type(error).__name__
            )

            error_message = (
                self._sanitize_value(
                    str(error),
                    limit=MAX_ERROR_LENGTH,
                )
            )

            bot_id, discord_id = (
                self._get_bot_info()
            )

            embed = disnake.Embed(
                title=(
                    f"🤖 Bot: {bot_id} "
                    f"| ID: {discord_id}"
                ),
                description=(
                    "### ❌ Erro em Interação"
                ),
                color=0xE74C3C,
                timestamp=datetime.now(
                    timezone.utc
                ),
            )

            embed.add_field(
                name="📋 Tipo",
                value=(
                    f"`{command_type}`"
                ),
                inline=True,
            )

            embed.add_field(
                name="🔑 ID",
                value=(
                    f"`{self._sanitize_value(identifier, limit=500)}`"
                ),
                inline=True,
            )

            user_name = (
                self._sanitize_value(
                    info.get(
                        "user_name",
                        "Unknown",
                    ),
                    limit=200,
                )
            )

            user_id = info.get(
                "user_id",
                "N/A",
            )

            embed.add_field(
                name="👤 Usuário",
                value=(
                    f"{user_name}\n"
                    f"`{user_id}`"
                ),
                inline=True,
            )

            guild_name = (
                self._sanitize_value(
                    info.get(
                        "guild_name",
                        "DM",
                    ),
                    limit=200,
                )
            )

            channel_name = (
                self._sanitize_value(
                    info.get(
                        "channel_name",
                        "N/A",
                    ),
                    limit=200,
                )
            )

            embed.add_field(
                name="🏠 Local",
                value=(
                    f"**Servidor:** "
                    f"{guild_name}\n"
                    f"**Canal:** "
                    f"{channel_name}"
                ),
                inline=False,
            )

            embed.add_field(
                name="⚠️ Erro",
                value=(
                    f"**Tipo:** "
                    f"`{error_type}`\n"
                    f"**Mensagem:** "
                    f"`{error_message}`"
                )[:1024],
                inline=False,
            )

            embed.set_footer(
                text=(
                    "Timestamp UTC: "
                    f"{info.get('timestamp', 'N/A')}"
                )
            )

            await self._send_webhook_with_retry(
                ERROR_WEBHOOK_URL,
                {
                    "embeds": [
                        embed.to_dict()
                    ],
                    "username": (
                        f"{bot_id} - "
                        "Error Monitor"
                    ),
                    "allowed_mentions": {
                        "parse": []
                    },
                },
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "[InteractionMonitor] "
                "Erro ao registrar erro "
                "de application command."
            )

    # ═════════════════════════════════════════════
    # SLASH ERROR
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_slash_command_error"
    )
    async def on_slash_command_error_monitor(
        self,
        inter: disnake.ApplicationCommandInteraction,
        error: Exception,
    ):
        await self._send_command_error(
            inter,
            error,
            "slash_command",
        )

    # ═════════════════════════════════════════════
    # USER COMMAND ERROR
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_user_command_error"
    )
    async def on_user_command_error_monitor(
        self,
        inter: disnake.ApplicationCommandInteraction,
        error: Exception,
    ):
        await self._send_command_error(
            inter,
            error,
            "user_command",
        )

    # ═════════════════════════════════════════════
    # MESSAGE COMMAND ERROR
    # ═════════════════════════════════════════════

    @commands.Cog.listener(
        "on_message_command_error"
    )
    async def on_message_command_error_monitor(
        self,
        inter: disnake.ApplicationCommandInteraction,
        error: Exception,
    ):
        await self._send_command_error(
            inter,
            error,
            "message_command",
        )

    # ═════════════════════════════════════════════
    # SHUTDOWN
    # ═════════════════════════════════════════════

    def cog_unload(
        self,
    ):
        self._closed = True

        session = self._session

        if (
            session is None
            or session.closed
        ):
            return

        try:
            loop = (
                asyncio.get_running_loop()
            )

            loop.create_task(
                session.close()
            )

        except RuntimeError:
            pass


def setup(
    bot: commands.Bot,
):
    bot.add_cog(
        InteractionMonitor(bot)
    )