import logging

from disnake.ext import commands


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# EXTENSÕES ATIVAS
# ═════════════════════════════════════════════════════════════

EXTENSIONS = (
    # Monitor geral de interações.
    # Mantido primeiro por organização.
    "events.interaction_monitor",

    # ─────────────────────────────────────────────
    # MEMBROS
    # ─────────────────────────────────────────────
    "events.on_member_ban",
    "events.on_member_join",
    "events.on_member_remove",
    "events.on_member_update_roles",
    "events.on_member_update_permissions",
    "events.on_member_update_timeout",

    # ─────────────────────────────────────────────
    # CANAIS
    # ─────────────────────────────────────────────
    "events.on_guild_channel_create",
    "events.on_guild_channel_delete",
    "events.on_guild_channel_update",

    # ─────────────────────────────────────────────
    # CARGOS
    # ─────────────────────────────────────────────
    "events.on_guild_role_create",
    "events.on_guild_role_delete",

    # ─────────────────────────────────────────────
    # MENSAGENS
    # ─────────────────────────────────────────────
    "events.on_message_delete",
    "events.on_message_edit",

    # ─────────────────────────────────────────────
    # VOZ
    # ─────────────────────────────────────────────
    "events.on_voice_state_update",

    # ─────────────────────────────────────────────
    # COMANDOS
    # ─────────────────────────────────────────────
    "events.on_command",

    # ─────────────────────────────────────────────
    # READY / INICIALIZAÇÃO
    # ─────────────────────────────────────────────
    "events.on_ready",
)


# ═════════════════════════════════════════════════════════════
# EXTENSÕES DESATIVADAS
# ═════════════════════════════════════════════════════════════
#
# NÃO carregar estas junto com on_ready caso o on_ready
# já esteja inicializando os mesmos WebSockets.
#

DISABLED_EXTENSIONS = (
    "events.websocket_ready",
    "events.boost_websocket_ready",
)


# ═════════════════════════════════════════════════════════════
# CARREGAMENTO
# ═════════════════════════════════════════════════════════════

def _load_extension(
    bot: commands.Bot,
    extension: str,
) -> bool:
    """
    Carrega uma extensão individualmente.

    Um erro em uma extensão não impede que
    as próximas sejam carregadas.
    """

    # Evita tentar carregar novamente uma
    # extensão que já está ativa.
    if extension in bot.extensions:
        logger.debug(
            "[Events] Extensão já carregada: %s",
            extension,
        )
        return True

    try:
        bot.load_extension(
            extension
        )

        logger.info(
            "[Events] Carregado: %s",
            extension,
        )

        return True

    except commands.ExtensionAlreadyLoaded:
        logger.debug(
            "[Events] Extensão já carregada: %s",
            extension,
        )

        return True

    except commands.ExtensionNotFound:
        logger.error(
            "[Events] Extensão não encontrada: %s",
            extension,
        )

    except commands.NoEntryPointError:
        logger.error(
            "[Events] A extensão %s não possui setup(bot).",
            extension,
        )

    except commands.ExtensionFailed as error:
        logger.error(
            "[Events] Falha ao carregar %s: %s",
            extension,
            error,
            exc_info=True,
        )

    except Exception:
        logger.exception(
            "[Events] Erro inesperado ao carregar %s.",
            extension,
        )

    return False


# ═════════════════════════════════════════════════════════════
# SETUP
# ═════════════════════════════════════════════════════════════

def setup(
    bot: commands.Bot,
):
    carregadas = 0
    falharam = []

    for extension in EXTENSIONS:
        sucesso = _load_extension(
            bot,
            extension,
        )

        if sucesso:
            carregadas += 1
        else:
            falharam.append(
                extension
            )

    # ═════════════════════════════════════════════
    # RESUMO
    # ═════════════════════════════════════════════

    logger.info(
        "[Events] Inicialização concluída: "
        "%s/%s extensões carregadas.",
        carregadas,
        len(EXTENSIONS),
    )

    if falharam:
        logger.warning(
            "[Events] Extensões com falha: %s",
            ", ".join(falharam),
        )