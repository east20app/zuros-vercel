from typing import Any

from functions.database import database as db
from core.enable_intents import enable_intents


# ═════════════════════════════════════════════════════════════
# CAMINHOS
# ═════════════════════════════════════════════════════════════

EMOJIS_PATH = "database/emojis/emojis.json"
EMOJIS_DATA_PATH = "database/emojis/emojis_data.json"
EMOJI_CONFIG_PATH = "configs/config_emoji.json"


# ═════════════════════════════════════════════════════════════
# HELPERS
# ═════════════════════════════════════════════════════════════


def _load_dict(
    path: str,
) -> dict:
    """
    Carrega um arquivo através do helper
    de database e garante retorno em dict.
    """

    try:
        data = db.obter(
            path
        )

        if isinstance(
            data,
            dict,
        ):
            return data

    except Exception:
        pass

    return {}


# ═════════════════════════════════════════════════════════════
# EMOJIS
# ═════════════════════════════════════════════════════════════


class emoji:
    """
    Disponibiliza os emojis como atributos.

    Exemplo:
        emoji.correct
        emoji.wrong
        emoji.loading
        emoji.member
    """

    _emoji_data = _load_dict(
        EMOJIS_PATH
    )

    for _key, _value in _emoji_data.items():
        locals()[
            _key
        ] = _value

    # Remove variáveis temporárias da classe.
    del _emoji_data

    try:
        del _key
        del _value
    except NameError:
        pass


# ═════════════════════════════════════════════════════════════
# INICIALIZAÇÃO
# ═════════════════════════════════════════════════════════════


def init_on_startup(
    bot_token: str,
    app_id: str,
) -> None:
    """
    Inicializa/sincroniza os emojis quando necessário.

    Mantém exatamente as regras atuais:

    1. Se config_emoji.isConfigured for True:
       não sincroniza.

    2. Caso contrário, sincroniza quando:
       - configured != "True"
       OU
       - lastToken existe e é diferente
         do token atual.
    """

    emojis_data = _load_dict(
        EMOJIS_DATA_PATH
    )

    config_emoji = _load_dict(
        EMOJI_CONFIG_PATH
    )

    # ═════════════════════════════════════════════
    # CONFIGURAÇÃO GLOBAL
    # ═════════════════════════════════════════════

    is_configured = (
        config_emoji.get(
            "isConfigured",
            False,
        )
    )

    # Mantém o comportamento original:
    # True significa não sincronizar.
    if is_configured:
        return

    # ═════════════════════════════════════════════
    # ESTADO DOS EMOJIS
    # ═════════════════════════════════════════════

    configured = emojis_data.get(
        "configured",
        "false",
    )

    last_token = emojis_data.get(
        "lastToken",
        "",
    )

    # IMPORTANTE:
    # Mantida exatamente a lógica original.
    should_zuros = (
        configured != "True"
        or (
            last_token
            and last_token != bot_token
        )
    )

    if not should_zuros:
        return

    # ═════════════════════════════════════════════
    # INTENTS
    # ═════════════════════════════════════════════

    enable_intents(
        bot_token,
        app_id,
    )

    # Import local mantido propositalmente.
    from functions.emojis import (
        emojis as Emojis,
    )

    # ═════════════════════════════════════════════
    # SINCRONIZAÇÃO
    # ═════════════════════════════════════════════

    Emojis(
        bot_token,
        app_id,
    ).zuros_all()