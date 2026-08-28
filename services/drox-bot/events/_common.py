import asyncio
import logging
import time
from typing import (
    Callable,
    Iterable,
    Optional,
)

import disnake

from functions.database import database as db
from functions.emoji import emoji


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════

DEFAULT_PRIMARY_COLOR = 0x5C5EF0

DEFAULT_LOG_MODE = "embed"

AUDIT_LOG_LIMIT = 20

DEFAULT_AUDIT_MAX_AGE = 60
DEFAULT_AUDIT_RETRIES = 3
DEFAULT_AUDIT_DELAY = 0.8


# ═════════════════════════════════════════════════════════════
# DATABASE
# ═════════════════════════════════════════════════════════════


def _get_document(
    name: str,
) -> dict:
    """
    Obtém um documento do banco com segurança.

    Sempre retorna dict.
    """

    try:
        data = (
            db.get_document(name)
            or {}
        )

        if isinstance(
            data,
            dict,
        ):
            return data

    except Exception:
        logger.exception(
            "Erro ao carregar documento '%s'.",
            name,
        )

    return {}


# ═════════════════════════════════════════════════════════════
# CANAIS
# ═════════════════════════════════════════════════════════════


def obter_canal_id(
    chave: str,
) -> Optional[int]:
    """
    Retorna o ID de um canal configurado.

    Retorna None quando:
    - chave não existe;
    - valor está vazio;
    - valor não é um ID válido.
    """

    if not chave:
        return None

    dados = _get_document(
        "canais"
    )

    valor = dados.get(
        chave
    )

    if valor in (
        None,
        "",
        0,
        "0",
    ):
        return None

    try:
        canal_id = int(
            valor
        )

    except (
        TypeError,
        ValueError,
    ):
        logger.warning(
            "ID de canal inválido em '%s': %r",
            chave,
            valor,
        )

        return None

    if canal_id <= 0:
        return None

    return canal_id


# ═════════════════════════════════════════════════════════════
# COR
# ═════════════════════════════════════════════════════════════


def _get_primary_color() -> int:
    """
    Obtém a cor primária configurada.

    Aceita:
    #5c5ef0
    5c5ef0
    0x5c5ef0
    inteiro
    """

    dados = _get_document(
        "custom_colors"
    )

    valor = dados.get(
        "primary",
        DEFAULT_PRIMARY_COLOR,
    )

    if isinstance(
        valor,
        int,
    ):
        if 0 <= valor <= 0xFFFFFF:
            return valor

        return DEFAULT_PRIMARY_COLOR

    try:
        texto = str(
            valor
        ).strip()

        texto = texto.removeprefix(
            "#"
        )

        texto = texto.removeprefix(
            "0x"
        )

        texto = texto.removeprefix(
            "0X"
        )

        cor = int(
            texto,
            16,
        )

        if not (
            0 <= cor <= 0xFFFFFF
        ):
            raise ValueError(
                "Cor fora do intervalo RGB."
            )

        return cor

    except (
        TypeError,
        ValueError,
    ):
        logger.warning(
            "Cor primária inválida: %r. "
            "Usando padrão #%06X.",
            valor,
            DEFAULT_PRIMARY_COLOR,
        )

        return DEFAULT_PRIMARY_COLOR


# ═════════════════════════════════════════════════════════════
# MODE
# ═════════════════════════════════════════════════════════════


def _get_log_mode() -> str:
    """
    Obtém o modo visual dos logs.

    Retorno:
    - components
    - embed
    """

    dados = _get_document(
        "custom_mode"
    )

    mode = str(
        dados.get(
            "mode",
            DEFAULT_LOG_MODE,
        )
        or DEFAULT_LOG_MODE
    ).strip().lower()

    if mode in {
        "components",
        "component",
        "components_v2",
        "v2",
    }:
        return "components"

    return "embed"


# ═════════════════════════════════════════════════════════════
# LINHAS
# ═════════════════════════════════════════════════════════════


def _normalizar_linhas(
    linhas: Optional[list[str]],
) -> list[str]:
    """
    Remove valores None/vazios,
    preservando linhas vazias intencionais.
    """

    if not linhas:
        return []

    resultado = []

    for linha in linhas:
        if linha is None:
            continue

        linha = str(
            linha
        )

        # Preserva "" apenas quando foi
        # colocado intencionalmente como separador.
        resultado.append(
            linha
        )

    return resultado


def _montar_corpo(
    linhas: Optional[list[str]],
    *,
    fallback: str = "",
) -> str:
    linhas = _normalizar_linhas(
        linhas
    )

    if not linhas:
        return fallback

    return "\n".join(
        linhas
    )


# ═════════════════════════════════════════════════════════════
# COMPONENTS V2
# ═════════════════════════════════════════════════════════════


def criar_container_log(
    titulo: str,
    linhas: list[str],
) -> disnake.ui.Container:
    """
    Cria o Container padrão dos logs
    em Components V2.
    """

    corpo = _montar_corpo(
        linhas,
        fallback=(
            "Nenhuma informação adicional."
        ),
    )

    timestamp = int(
        time.time()
    )

    cor = _get_primary_color()

    return disnake.ui.Container(
        disnake.ui.TextDisplay(
            f"# {emoji.zuros}\n"
            f"-# {titulo}"
        ),

        disnake.ui.Separator(),

        disnake.ui.TextDisplay(
            corpo
        ),

        disnake.ui.Separator(),

        disnake.ui.TextDisplay(
            f"{emoji.calendar} "
            f"**Data:** "
            f"<t:{timestamp}:f> "
            f"(<t:{timestamp}:R>)"
        ),

        accent_colour=disnake.Colour(
            cor
        ),
    )


# ═════════════════════════════════════════════════════════════
# EMBED
# ═════════════════════════════════════════════════════════════


def criar_embed_log(
    guild: disnake.Guild,
    titulo: str,
    linhas: list[str],
) -> disnake.Embed:
    """
    Cria o Embed padrão dos logs.
    """

    corpo = _montar_corpo(
        linhas,
        fallback=(
            "Nenhuma informação adicional."
        ),
    )

    embed = disnake.Embed(
        title=str(
            titulo
        ),
        description=corpo,
        color=_get_primary_color(),
        timestamp=disnake.utils.utcnow(),
    )

    # Footer simples e seguro.
    try:
        icon_url = None

        if guild.icon:
            icon_url = guild.icon.url

        embed.set_footer(
            text=guild.name,
            icon_url=icon_url,
        )

    except Exception:
        embed.set_footer(
            text=str(
                getattr(
                    guild,
                    "name",
                    "Servidor",
                )
            )
        )

    return embed


# ═════════════════════════════════════════════════════════════
# OBTER CANAL
# ═════════════════════════════════════════════════════════════


def _obter_canal_log(
    guild: disnake.Guild,
    canal_id: Optional[int],
):
    """
    Obtém o canal de logs da cache da guild.
    """

    if (
        guild is None
        or not canal_id
    ):
        return None

    try:
        return guild.get_channel(
            int(canal_id)
        )

    except (
        TypeError,
        ValueError,
        AttributeError,
    ):
        return None


# ═════════════════════════════════════════════════════════════
# ENVIAR COMPONENTS V2 FORÇADO
# ═════════════════════════════════════════════════════════════


async def enviar_log_container(
    guild: disnake.Guild,
    canal_id: Optional[int],
    titulo: str,
    linhas: list[str],
    extra_components: Optional[list] = None,
) -> None:
    """
    Envia um log forçando Components V2,
    independentemente do modo global.
    """

    if not canal_id:
        return

    canal = _obter_canal_log(
        guild,
        canal_id,
    )

    if canal is None:
        logger.warning(
            "Canal de log %s não encontrado "
            "no servidor %s.",
            canal_id,
            getattr(
                guild,
                "id",
                "desconhecido",
            ),
        )

        return

    try:
        container = criar_container_log(
            titulo,
            linhas,
        )

        components = [
            container
        ]

        if extra_components:
            components.extend(
                extra_components
            )

        await canal.send(
            components=components,

            flags=disnake.MessageFlags(
                is_components_v2=True
            ),

            allowed_mentions=(
                disnake.AllowedMentions.none()
            ),
        )

    except disnake.Forbidden:
        logger.warning(
            "Sem permissão para enviar logs "
            "no canal %s do servidor %s.",
            canal_id,
            guild.id,
        )

    except disnake.NotFound:
        logger.warning(
            "Canal de logs %s não existe mais.",
            canal_id,
        )

    except disnake.HTTPException:
        logger.exception(
            "Erro HTTP ao enviar log Components V2 "
            "no canal %s.",
            canal_id,
        )

    except asyncio.CancelledError:
        raise

    except Exception:
        logger.exception(
            "Erro inesperado ao enviar "
            "log Components V2."
        )


# ═════════════════════════════════════════════════════════════
# ENVIAR LOG
# ═════════════════════════════════════════════════════════════


async def enviar_log(
    guild: disnake.Guild,
    canal_id: Optional[int],
    titulo: str,
    linhas: list[str],
    extra_components: Optional[list] = None,
    file: Optional[disnake.File] = None,
) -> Optional[disnake.Message]:
    """
    Envia um log usando o modo configurado:

    custom_mode.mode:
    - components
    - embed

    Suporta:
    - Components V2
    - Embed
    - Botões/components extras
    - Arquivo
    - AllowedMentions.none()
    """

    if (
        guild is None
        or not canal_id
    ):
        return None

    canal = _obter_canal_log(
        guild,
        canal_id,
    )

    if canal is None:
        logger.warning(
            "Canal de logs %s não encontrado "
            "no servidor %s.",
            canal_id,
            getattr(
                guild,
                "id",
                "desconhecido",
            ),
        )

        return None

    mode = _get_log_mode()

    try:
        # ═════════════════════════════════════════
        # COMPONENTS V2
        # ═════════════════════════════════════════

        if mode == "components":
            container = (
                criar_container_log(
                    titulo,
                    linhas,
                )
            )

            components = [
                container
            ]

            if extra_components:
                components.extend(
                    extra_components
                )

            kwargs = {
                "components": components,

                "flags": disnake.MessageFlags(
                    is_components_v2=True
                ),

                "allowed_mentions": (
                    disnake.AllowedMentions.none()
                ),
            }

            # Seu código antigo recebia `file`,
            # mas não enviava o arquivo.
            if file is not None:
                kwargs["file"] = file

            return await canal.send(
                **kwargs
            )

        # ═════════════════════════════════════════
        # EMBED
        # ═════════════════════════════════════════

        embed = criar_embed_log(
            guild,
            titulo,
            linhas,
        )

        kwargs = {
            "embed": embed,

            "allowed_mentions": (
                disnake.AllowedMentions.none()
            ),
        }

        if extra_components:
            kwargs[
                "components"
            ] = extra_components

        if file is not None:
            kwargs[
                "file"
            ] = file

        return await canal.send(
            **kwargs
        )

    except disnake.Forbidden:
        logger.warning(
            "Sem permissão para enviar log "
            "no canal %s do servidor %s.",
            canal_id,
            guild.id,
        )

    except disnake.NotFound:
        logger.warning(
            "Canal de logs %s não existe mais.",
            canal_id,
        )

    except disnake.HTTPException:
        logger.exception(
            "Erro HTTP ao enviar log '%s' "
            "no canal %s.",
            titulo,
            canal_id,
        )

    except asyncio.CancelledError:
        raise

    except Exception:
        logger.exception(
            "Erro inesperado ao enviar "
            "log '%s'.",
            titulo,
        )

    return None


# ═════════════════════════════════════════════════════════════
# AUDIT LOG
# ═════════════════════════════════════════════════════════════


async def buscar_executor_auditlog(
    guild: disnake.Guild,
    actions: Iterable[
        disnake.AuditLogAction
    ],
    matcher: Callable[
        [disnake.AuditLogEntry],
        bool,
    ],
    max_age_seconds: int = DEFAULT_AUDIT_MAX_AGE,
    retries: int = DEFAULT_AUDIT_RETRIES,
    delay_seconds: float = DEFAULT_AUDIT_DELAY,
) -> Optional[disnake.abc.User]:
    """
    Procura o executor de uma ação no Audit Log.

    - Faz várias tentativas para aguardar a
      propagação do Audit Log do Discord.
    - Ignora entradas antigas.
    - Retorna entry.user quando matcher(entry)
      retornar True.
    """

    if guild is None:
        return None

    if not callable(
        matcher
    ):
        return None

    try:
        actions = tuple(
            action
            for action in actions
            if action is not None
        )

    except TypeError:
        return None

    if not actions:
        return None

    try:
        max_age_seconds = max(
            1,
            int(max_age_seconds),
        )

    except (
        TypeError,
        ValueError,
    ):
        max_age_seconds = (
            DEFAULT_AUDIT_MAX_AGE
        )

    try:
        retries = max(
            1,
            int(retries),
        )

    except (
        TypeError,
        ValueError,
    ):
        retries = (
            DEFAULT_AUDIT_RETRIES
        )

    try:
        delay_seconds = max(
            0.0,
            float(delay_seconds),
        )

    except (
        TypeError,
        ValueError,
    ):
        delay_seconds = (
            DEFAULT_AUDIT_DELAY
        )

    for attempt in range(
        retries
    ):
        try:
            for action in actions:
                async for entry in guild.audit_logs(
                    action=action,
                    limit=AUDIT_LOG_LIMIT,
                ):
                    created_at = getattr(
                        entry,
                        "created_at",
                        None,
                    )

                    # ═════════════════════════════
                    # IDADE DA ENTRADA
                    # ═════════════════════════════

                    if created_at is not None:
                        try:
                            idade = (
                                disnake.utils.utcnow()
                                - created_at
                            ).total_seconds()

                            # Audit Logs vêm do mais
                            # novo para o mais antigo.
                            if (
                                idade
                                > max_age_seconds
                            ):
                                break

                        except Exception:
                            pass

                    # ═════════════════════════════
                    # MATCH
                    # ═════════════════════════════

                    try:
                        corresponde = bool(
                            matcher(entry)
                        )

                    except Exception:
                        logger.debug(
                            "Matcher de Audit Log "
                            "lançou uma exceção.",
                            exc_info=True,
                        )

                        continue

                    if not corresponde:
                        continue

                    executor = getattr(
                        entry,
                        "user",
                        None,
                    )

                    if executor is not None:
                        return executor

            # ═════════════════════════════════════
            # AGUARDAR PROPAGAÇÃO
            # ═════════════════════════════════════

            if (
                attempt
                < retries - 1
                and delay_seconds > 0
            ):
                await asyncio.sleep(
                    delay_seconds
                )

        except disnake.Forbidden:
            logger.debug(
                "Sem permissão view_audit_log "
                "no servidor %s.",
                guild.id,
            )

            return None

        except disnake.HTTPException:
            logger.debug(
                "Erro HTTP ao consultar Audit Log "
                "do servidor %s "
                "(tentativa %s/%s).",
                guild.id,
                attempt + 1,
                retries,
                exc_info=True,
            )

            if (
                attempt
                < retries - 1
                and delay_seconds > 0
            ):
                await asyncio.sleep(
                    delay_seconds
                )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Erro inesperado ao consultar "
                "Audit Log do servidor %s.",
                guild.id,
            )

            return None

    return None


# ═════════════════════════════════════════════════════════════
# GUILD
# ═════════════════════════════════════════════════════════════


def verificar_guild(
    guild: int,
) -> bool:
    """
    Verifica se o servidor recebido é
    o servidor principal configurado do bot.
    """

    if not guild:
        return False

    try:
        config = (
            db.obter(
                "config.json"
            )
            or {}
        )

    except Exception:
        logger.exception(
            "Erro ao carregar config.json "
            "em verificar_guild()."
        )

        return False

    if not isinstance(
        config,
        dict,
    ):
        return False

    bot_config = (
        config.get("bot")
        or {}
    )

    if not isinstance(
        bot_config,
        dict,
    ):
        return False

    guild_id = bot_config.get(
        "server"
    )

    if not guild_id:
        return False

    return str(
        guild
    ) == str(
        guild_id
    )