"""
Função centralizada para chamadas de IA.

Fluxo:
1. Tenta GetProject.
2. Se falhar, usa Groq.
3. Alterna automaticamente entre as chaves Groq.
4. Alterna automaticamente entre os modelos.
"""

import asyncio
import logging
import os

import aiohttp


logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════
# GETPROJECT
# ═════════════════════════════════════════════════════════════

GETPROJECT_URL = (
    "https://getproject.online/api/unlimited-generate"
)

# Token fornecido exclusivamente pelo ambiente de execução.
GETPROJECT_TOKEN = os.getenv("GETPROJECT_TOKEN", "")


# ═════════════════════════════════════════════════════════════
# GROQ
# ═════════════════════════════════════════════════════════════

GROQ_URL = (
    "https://api.groq.com/openai/v1/chat/completions"
)

# Chaves separadas por vírgula no ambiente; sem fallback versionado.
GROQ_API_KEYS = [key.strip() for key in os.getenv("GROQ_API_KEYS", "").split(",") if key.strip()]


# Modelos em ordem de preferência / fallback
GROQ_MODELS = [
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
]


# ═════════════════════════════════════════════════════════════
# CONFIGURAÇÕES
# ═════════════════════════════════════════════════════════════

REQUEST_TIMEOUT = aiohttp.ClientTimeout(
    total=30,
    connect=10,
)

MAX_ERROR_LOG_LENGTH = 300

_groq_key_index = 0


# ═════════════════════════════════════════════════════════════
# HELPERS
# ═════════════════════════════════════════════════════════════

def _get_next_groq_key() -> str:
    """
    Retorna a próxima chave Groq usando rotação.
    """

    global _groq_key_index

    if not GROQ_API_KEYS:
        raise RuntimeError(
            "Nenhuma API Key da Groq foi configurada."
        )

    key = GROQ_API_KEYS[
        _groq_key_index
    ]

    _groq_key_index = (
        _groq_key_index + 1
    ) % len(GROQ_API_KEYS)

    return key


def _get_groq_keys_rotation() -> list[str]:
    """
    Retorna todas as keys começando pela próxima
    posição da rotação.
    """

    if not GROQ_API_KEYS:
        return []

    first_key = _get_next_groq_key()

    try:
        start_index = GROQ_API_KEYS.index(
            first_key
        )
    except ValueError:
        start_index = 0

    return (
        GROQ_API_KEYS[start_index:]
        + GROQ_API_KEYS[:start_index]
    )


def _normalize_getproject_token(
    token: str,
) -> str:
    """
    Garante que o token tenha prefixo Bearer.
    """

    token = str(
        token or ""
    ).strip()

    if not token:
        return ""

    if token.lower().startswith(
        "bearer "
    ):
        return token

    return f"Bearer {token}"


def _module_settings(
    module_name: str,
) -> tuple[float, int]:
    """
    Ajusta temperatura e limite de resposta
    dependendo do módulo.
    """

    module = str(
        module_name or ""
    ).strip().lower()

    # Moderador precisa ser determinístico.
    if module in {
        "filtrotos",
        "moderator",
        "moderacao",
    }:
        return 0.0, 32

    # Chat pode ser mais natural.
    if module in {
        "aichat",
        "chat",
    }:
        return 0.6, 2048

    # Padrão.
    return 0.4, 2048


def _safe_error_text(
    text: str,
) -> str:
    text = str(
        text or ""
    ).strip()

    if len(text) <= MAX_ERROR_LOG_LENGTH:
        return text

    return (
        text[:MAX_ERROR_LOG_LENGTH]
        + "..."
    )


def _extract_getproject_response(
    data,
) -> str:
    """
    Extrai a resposta da GetProject de forma segura.
    """

    if not isinstance(
        data,
        dict,
    ):
        return ""

    # Formato atual
    text = data.get("text")

    if isinstance(text, str):
        return text.strip()

    # Fallback para formato semelhante ao OpenAI
    choices = data.get("choices")

    if isinstance(
        choices,
        list,
    ) and choices:

        first = choices[0]

        if isinstance(first, dict):
            message_data = (
                first.get("message")
                or {}
            )

            if isinstance(
                message_data,
                dict,
            ):
                content = message_data.get(
                    "content"
                )

                if isinstance(
                    content,
                    str,
                ):
                    return content.strip()

    return ""


def _extract_groq_response(
    data,
) -> str:
    """
    Extrai choices[0].message.content da Groq.
    """

    if not isinstance(
        data,
        dict,
    ):
        return ""

    choices = data.get("choices")

    if not isinstance(
        choices,
        list,
    ) or not choices:
        return ""

    first = choices[0]

    if not isinstance(
        first,
        dict,
    ):
        return ""

    message_data = (
        first.get("message")
        or {}
    )

    if not isinstance(
        message_data,
        dict,
    ):
        return ""

    content = message_data.get(
        "content"
    )

    if not isinstance(
        content,
        str,
    ):
        return ""

    return content.strip()


# ═════════════════════════════════════════════════════════════
# GETPROJECT
# ═════════════════════════════════════════════════════════════

async def _call_getproject(
    conteudo: str,
    module_name: str = "IA",
) -> tuple[str, bool]:
    """
    Chama a GetProject.

    Retorna:
        (resposta, sucesso)
    """

    token = _normalize_getproject_token(
        GETPROJECT_TOKEN
    )

    if not token:
        logger.warning(
            "[%s] GetProject não possui token configurado.",
            module_name,
        )

        return "", False

    headers = {
        "Authorization": token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "model": "Project-Model-Free",
        "messages": [
            {
                "content": conteudo,
            }
        ],
    }

    try:
        async with aiohttp.ClientSession(
            timeout=REQUEST_TIMEOUT
        ) as session:

            async with session.post(
                GETPROJECT_URL,
                headers=headers,
                json=payload,
            ) as response:

                # ─────────────────────────────────
                # ERRO HTTP
                # ─────────────────────────────────

                if response.status != 200:
                    try:
                        error_text = (
                            await response.text()
                        )
                    except Exception:
                        error_text = ""

                    logger.warning(
                        "[%s] GetProject retornou HTTP %s: %s",
                        module_name,
                        response.status,
                        _safe_error_text(
                            error_text
                        ),
                    )

                    return "", False

                # ─────────────────────────────────
                # JSON
                # ─────────────────────────────────

                try:
                    data = await response.json(
                        content_type=None
                    )

                except (
                    aiohttp.ContentTypeError,
                    ValueError,
                ):
                    logger.warning(
                        "[%s] GetProject retornou "
                        "uma resposta inválida.",
                        module_name,
                    )

                    return "", False

                content = (
                    _extract_getproject_response(
                        data
                    )
                )

                if not content:
                    logger.warning(
                        "[%s] GetProject respondeu "
                        "sem conteúdo.",
                        module_name,
                    )

                    return "", False

                return content, True

    except asyncio.TimeoutError:
        logger.warning(
            "[%s] Timeout na GetProject.",
            module_name,
        )

    except aiohttp.ClientError as error:
        logger.warning(
            "[%s] Erro de conexão GetProject: %s",
            module_name,
            error,
        )

    except Exception:
        logger.exception(
            "[%s] Erro inesperado na GetProject.",
            module_name,
        )

    return "", False


# ═════════════════════════════════════════════════════════════
# GROQ
# ═════════════════════════════════════════════════════════════

async def _call_groq(
    conteudo: str,
    module_name: str = "IA",
) -> str:
    """
    Chama a Groq utilizando:

    - rotação de API Keys;
    - fallback de modelos;
    - tratamento de rate limit;
    - tratamento de modelos indisponíveis.
    """

    keys = _get_groq_keys_rotation()

    if not keys:
        logger.error(
            "[%s] Nenhuma chave Groq configurada.",
            module_name,
        )

        return ""

    temperature, max_tokens = (
        _module_settings(
            module_name
        )
    )

    # Primeiro tenta o modelo mais barato/rápido.
    for model_index, model in enumerate(
        GROQ_MODELS
    ):

        model_unavailable = False

        for key_index, api_key in enumerate(
            keys
        ):
            headers = {
                "Authorization": (
                    f"Bearer {api_key}"
                ),
                "Content-Type": (
                    "application/json"
                ),
                "Accept": "application/json",
            }

            payload = {
                "model": model,

                "messages": [
                    {
                        "role": "user",
                        "content": conteudo,
                    }
                ],

                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            try:
                async with aiohttp.ClientSession(
                    timeout=REQUEST_TIMEOUT
                ) as session:

                    async with session.post(
                        GROQ_URL,
                        headers=headers,
                        json=payload,
                    ) as response:

                        # ═════════════════════════
                        # SUCESSO
                        # ═════════════════════════

                        if response.status == 200:
                            try:
                                data = (
                                    await response.json(
                                        content_type=None
                                    )
                                )

                            except (
                                aiohttp.ContentTypeError,
                                ValueError,
                            ):
                                logger.warning(
                                    "[%s] Groq retornou "
                                    "JSON inválido.",
                                    module_name,
                                )

                                continue

                            content = (
                                _extract_groq_response(
                                    data
                                )
                            )

                            if content:
                                if model_index > 0:
                                    logger.info(
                                        "[%s] Groq: fallback "
                                        "bem-sucedido com %s.",
                                        module_name,
                                        model,
                                    )

                                return content

                            continue

                        # ═════════════════════════
                        # ERRO
                        # ═════════════════════════

                        try:
                            error_data = (
                                await response.json(
                                    content_type=None
                                )
                            )

                            error_message = str(
                                (
                                    error_data.get(
                                        "error"
                                    )
                                    or {}
                                ).get(
                                    "message",
                                    "",
                                )
                            )

                        except Exception:
                            try:
                                error_message = (
                                    await response.text()
                                )
                            except Exception:
                                error_message = ""

                        error_message = (
                            _safe_error_text(
                                error_message
                            )
                        )

                        # ─────────────────────────
                        # KEY INVÁLIDA
                        # ─────────────────────────

                        if response.status in {
                            401,
                            403,
                        }:
                            logger.warning(
                                "[%s] Groq: key %s/%s "
                                "não autorizada. Tentando "
                                "a próxima key.",
                                module_name,
                                key_index + 1,
                                len(keys),
                            )

                            continue

                        # ─────────────────────────
                        # RATE LIMIT
                        # ─────────────────────────

                        if response.status == 429:
                            logger.warning(
                                "[%s] Groq: rate limit "
                                "na key %s/%s.",
                                module_name,
                                key_index + 1,
                                len(keys),
                            )

                            # Primeiro tenta outra key,
                            # sem prender o bot esperando.
                            continue

                        # ─────────────────────────
                        # MODELO INVÁLIDO / REMOVIDO
                        # ─────────────────────────

                        if response.status == 400:
                            lower_error = (
                                error_message.lower()
                            )

                            if any(
                                text in lower_error
                                for text in (
                                    "decommissioned",
                                    "no longer supported",
                                    "model not found",
                                    "does not exist",
                                )
                            ):
                                logger.warning(
                                    "[%s] Modelo Groq %s "
                                    "indisponível. Tentando "
                                    "próximo modelo.",
                                    module_name,
                                    model,
                                )

                                model_unavailable = True
                                break

                            logger.warning(
                                "[%s] Groq HTTP 400 no "
                                "modelo %s: %s",
                                module_name,
                                model,
                                error_message,
                            )

                            # 400 normalmente não depende
                            # da API key.
                            model_unavailable = True
                            break

                        # ─────────────────────────
                        # SERVIDOR
                        # ─────────────────────────

                        if response.status >= 500:
                            logger.warning(
                                "[%s] Groq HTTP %s "
                                "com modelo %s.",
                                module_name,
                                response.status,
                                model,
                            )

                            continue

                        logger.warning(
                            "[%s] Groq HTTP %s "
                            "com modelo %s: %s",
                            module_name,
                            response.status,
                            model,
                            error_message,
                        )

            except asyncio.TimeoutError:
                logger.warning(
                    "[%s] Timeout Groq: %s "
                    "(key %s/%s).",
                    module_name,
                    model,
                    key_index + 1,
                    len(keys),
                )

                continue

            except aiohttp.ClientError as error:
                logger.warning(
                    "[%s] Erro de conexão Groq "
                    "com %s: %s",
                    module_name,
                    model,
                    error,
                )

                continue

            except Exception:
                logger.exception(
                    "[%s] Erro inesperado Groq "
                    "com modelo %s.",
                    module_name,
                    model,
                )

                continue

        if model_unavailable:
            continue

        # Todas as keys falharam neste modelo.
        if model_index < len(
            GROQ_MODELS
        ) - 1:
            logger.warning(
                "[%s] Todas as keys falharam "
                "com %s. Tentando próximo modelo.",
                module_name,
                model,
            )

    logger.error(
        "[%s] Todos os modelos e keys "
        "da Groq falharam.",
        module_name,
    )

    return ""


# ═════════════════════════════════════════════════════════════
# FUNÇÃO PRINCIPAL
# ═════════════════════════════════════════════════════════════

async def chamar_ia(
    conteudo: str,
    module_name: str = "IA",
) -> str:
    """
    Função utilizada pelos módulos do bot.

    Ordem:
        1. GetProject
        2. Groq

    Retorna string vazia caso todas as APIs falhem.
    """

    conteudo = str(
        conteudo or ""
    ).strip()

    if not conteudo:
        logger.warning(
            "[%s] Tentativa de chamar IA "
            "com conteúdo vazio.",
            module_name,
        )

        return ""

    # ═════════════════════════════════════════════
    # 1. GETPROJECT
    # ═════════════════════════════════════════════

    resposta, sucesso = (
        await _call_getproject(
            conteudo,
            module_name,
        )
    )

    if sucesso and resposta:
        return resposta.strip()

    # ═════════════════════════════════════════════
    # 2. GROQ
    # ═════════════════════════════════════════════

    logger.info(
        "[%s] GetProject indisponível. "
        "Usando fallback Groq.",
        module_name,
    )

    resposta = await _call_groq(
        conteudo,
        module_name,
    )

    if resposta:
        return resposta.strip()

    # ═════════════════════════════════════════════
    # FALHA TOTAL
    # ═════════════════════════════════════════════

    logger.error(
        "[%s] Todas as APIs de IA falharam.",
        module_name,
    )

    return ""