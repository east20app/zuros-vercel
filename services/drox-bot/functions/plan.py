"""
Gerenciador de planos do bot.

Controla quais funcionalidades estão disponíveis
com base no plano configurado.
"""

import json
import os
from typing import Final


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═════════════════════════════════════════════════════════════

CONFIG_PATH: Final[str] = (
    "configs/config_plan.json"
)

DEFAULT_PLAN: Final[str] = "pro"


# ═════════════════════════════════════════════════════════════
# PLANOS
# ═════════════════════════════════════════════════════════════

PLAN_PRO: Final[str] = "pro"
PLAN_BASIC: Final[str] = "basic"
PLAN_CLOUD: Final[str] = "cloud"
PLAN_FREE: Final[str] = "free"


# ═════════════════════════════════════════════════════════════
# MÓDULOS / COMANDOS
# ═════════════════════════════════════════════════════════════

CLOUD_ALLOWED_MODULES = frozenset({
    "backup",
    "cloud",
    "settings",
    "customization",
})

BASIC_BLOCKED_MODULES = frozenset({
    "backup",
    "cloud",
})

FREE_BLOCKED_MODULES = frozenset({
    "cloud",
    "protection",
    "backup",
})


CLOUD_ALLOWED_COMMANDS = frozenset({
    "painel",
    "anunciar",
    "backup",
})

FREE_BLOCKED_COMMANDS = frozenset({
    "backup",
    "cloud",
    "protection",
})


# ═════════════════════════════════════════════════════════════
# BOTÕES DO PAINEL
# ═════════════════════════════════════════════════════════════

BUTTON_TO_MODULE = {
    "loja": "loja",
    "ticket": "tickets",
    "cloud": "cloud",
    "personalizacao": "customization",
    "automacoes": "automations",
    "protection": "protection",
    "sorteios": "giveaways",
    "configuracoes": "settings",
    "rendimentos": "rendimentos",
}


CLOUD_ALLOWED_PANEL_MODULES = frozenset({
    "cloud",
    "settings",
    "customization",
})

FREE_BLOCKED_PANEL_MODULES = frozenset({
    "cloud",
    "protection",
    "backup",
})


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════

CLOUD_ALLOWED_SETTINGS = frozenset({
    "cargos",
    "canais",
})


# ═════════════════════════════════════════════════════════════
# PLANO ATUAL
# ═════════════════════════════════════════════════════════════


def get_plan() -> str:
    """
    Obtém o plano atual configurado.

    Returns:
        str:
            Plano atual.

            Valores normalmente utilizados:
            - pro
            - basic
            - cloud
            - free

    Caso o arquivo não exista ou aconteça algum erro,
    retorna "pro", mantendo o comportamento atual.
    """

    try:
        if os.path.exists(
            CONFIG_PATH
        ):
            with open(
                CONFIG_PATH,
                "r",
                encoding="utf-8",
            ) as file:
                data = json.load(
                    file
                )

            return (
                data.get(
                    "plan",
                    DEFAULT_PLAN,
                )
                .lower()
            )

    except Exception as error:
        print(
            "Erro ao ler "
            "configs/config_plan.json: "
            f"{error}"
        )

    return DEFAULT_PLAN


# ═════════════════════════════════════════════════════════════
# VERIFICAÇÃO DIRETA DO PLANO
# ═════════════════════════════════════════════════════════════


def is_pro() -> bool:
    """
    Verifica se o plano atual é Pro.

    Pro possui todas as funcionalidades.
    """

    return (
        get_plan()
        == PLAN_PRO
    )


def is_basic() -> bool:
    """
    Verifica se o plano atual é Basic.

    Basic não possui backup e cloud.
    """

    return (
        get_plan()
        == PLAN_BASIC
    )


def is_cloud() -> bool:
    """
    Verifica se o plano atual é Cloud.
    """

    return (
        get_plan()
        == PLAN_CLOUD
    )


def is_free() -> bool:
    """
    Verifica se o plano atual é Free.

    No plano Free apenas Zuros Wallet
    é permitido como método de pagamento.
    """

    return (
        get_plan()
        == PLAN_FREE
    )


# ═════════════════════════════════════════════════════════════
# PAGAMENTOS
# ═════════════════════════════════════════════════════════════


def should_allow_payment_provider(
    provider_key: str,
) -> bool:
    """
    Verifica se um provedor de pagamento
    pode ser configurado no plano atual.

    Args:
        provider_key:
            Chave do provedor.

            Exemplo:
            - zuros_wallet
            - mercado_pago
            - efibank

    Returns:
        bool:
            True se o provedor for permitido.
    """

    plan = get_plan()

    if plan == PLAN_FREE:
        return (
            provider_key
            == "zuros_wallet"
        )

    return True


# ═════════════════════════════════════════════════════════════
# BACKUP
# ═════════════════════════════════════════════════════════════


def should_load_backup() -> bool:
    """
    Verifica se o módulo de backup
    deve ser carregado.
    """

    plan = get_plan()

    return plan in {
        PLAN_PRO,
        PLAN_CLOUD,
    }


# ═════════════════════════════════════════════════════════════
# CLOUD
# ═════════════════════════════════════════════════════════════


def should_load_cloud() -> bool:
    """
    Verifica se o módulo Cloud
    deve ser carregado.
    """

    plan = get_plan()

    return plan in {
        PLAN_PRO,
        PLAN_CLOUD,
    }


# ═════════════════════════════════════════════════════════════
# MÓDULOS
# ═════════════════════════════════════════════════════════════


def should_load_module(
    module_name: str,
) -> bool:
    """
    Verifica se um módulo específico deve
    ser carregado com base no plano.

    Args:
        module_name:
            Nome do módulo.

            Exemplos:
            - automations
            - tickets
            - settings
            - customization

    Returns:
        bool:
            True se o módulo deve ser carregado.
    """

    plan = get_plan()

    # ═════════════════════════════════════════════
    # PRO
    # ═════════════════════════════════════════════

    if plan == PLAN_PRO:
        return True

    # ═════════════════════════════════════════════
    # CLOUD
    # ═════════════════════════════════════════════

    if plan == PLAN_CLOUD:
        return (
            module_name
            in CLOUD_ALLOWED_MODULES
        )

    # ═════════════════════════════════════════════
    # BASIC
    # ═════════════════════════════════════════════

    if plan == PLAN_BASIC:
        return (
            module_name
            not in BASIC_BLOCKED_MODULES
        )

    # ═════════════════════════════════════════════
    # FREE
    # ═════════════════════════════════════════════

    if plan == PLAN_FREE:
        return (
            module_name
            not in FREE_BLOCKED_MODULES
        )

    # Mantém o comportamento original:
    # plano desconhecido permite o módulo.
    return True


# ═════════════════════════════════════════════════════════════
# COMANDOS
# ═════════════════════════════════════════════════════════════


def should_load_command(
    command_name: str,
) -> bool:
    """
    Verifica se um comando específico
    deve ser carregado com base no plano.

    Args:
        command_name:
            Nome do comando.

            Exemplos:
            - painel
            - backup
            - anunciar

    Returns:
        bool:
            True se o comando deve ser carregado.
    """

    plan = get_plan()

    # ═════════════════════════════════════════════
    # PRO
    # ═════════════════════════════════════════════

    if plan == PLAN_PRO:
        return True

    # ═════════════════════════════════════════════
    # CLOUD
    # ═════════════════════════════════════════════

    if plan == PLAN_CLOUD:
        return (
            command_name
            in CLOUD_ALLOWED_COMMANDS
        )

    # ═════════════════════════════════════════════
    # BASIC
    # ═════════════════════════════════════════════

    if plan == PLAN_BASIC:
        return (
            command_name
            != "backup"
        )

    # ═════════════════════════════════════════════
    # FREE
    # ═════════════════════════════════════════════

    if plan == PLAN_FREE:
        return (
            command_name
            not in FREE_BLOCKED_COMMANDS
        )

    return True


# ═════════════════════════════════════════════════════════════
# BOTÃO CLOUD
# ═════════════════════════════════════════════════════════════


def should_enable_cloud_button() -> bool:
    """
    Verifica se o botão ZurosCloud
    deve estar habilitado no painel.
    """

    plan = get_plan()

    return plan in {
        PLAN_PRO,
        PLAN_CLOUD,
    }


# ═════════════════════════════════════════════════════════════
# BOTÕES DO PAINEL
# ═════════════════════════════════════════════════════════════


def should_enable_panel_button(
    button_name: str,
) -> bool:
    """
    Verifica se um botão específico do painel
    deve estar habilitado.

    Args:
        button_name:
            Nome do botão.

            Exemplos:
            - ticket
            - cloud
            - personalizacao
            - automacoes

    Returns:
        bool:
            True se o botão deve estar habilitado.
    """

    plan = get_plan()

    # ═════════════════════════════════════════════
    # PRO
    # ═════════════════════════════════════════════

    if plan == PLAN_PRO:
        return True

    module_name = BUTTON_TO_MODULE.get(
        button_name,
        button_name,
    )

    # ═════════════════════════════════════════════
    # CLOUD
    # ═════════════════════════════════════════════

    if plan == PLAN_CLOUD:
        return (
            module_name
            in CLOUD_ALLOWED_PANEL_MODULES
        )

    # ═════════════════════════════════════════════
    # BASIC
    # ═════════════════════════════════════════════

    if plan == PLAN_BASIC:
        return (
            module_name
            != "cloud"
        )

    # ═════════════════════════════════════════════
    # FREE
    # ═════════════════════════════════════════════

    if plan == PLAN_FREE:
        return (
            module_name
            not in FREE_BLOCKED_PANEL_MODULES
        )

    return True


# ═════════════════════════════════════════════════════════════
# BOTÕES DE CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════


def should_enable_settings_button(
    button_name: str,
) -> bool:
    """
    Verifica se um botão específico
    de configurações deve estar habilitado.

    Args:
        button_name:
            Nome do botão.

            Exemplos:
            - cargos
            - canais
            - pagamentos

    Returns:
        bool:
            True se o botão deve estar habilitado.
    """

    plan = get_plan()

    # ═════════════════════════════════════════════
    # PRO
    # ═════════════════════════════════════════════

    if plan == PLAN_PRO:
        return True

    # ═════════════════════════════════════════════
    # CLOUD
    # ═════════════════════════════════════════════

    if plan == PLAN_CLOUD:
        return (
            button_name
            in CLOUD_ALLOWED_SETTINGS
        )

    # ═════════════════════════════════════════════
    # BASIC
    # ═════════════════════════════════════════════

    if plan == PLAN_BASIC:
        return True

    # Mantém exatamente o comportamento original:
    # Free e planos desconhecidos retornam True.
    return True