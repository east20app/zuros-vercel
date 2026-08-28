"""
Utilitários para manipulação de texto
e validação de limites do Discord.
"""


# ═════════════════════════════════════════════════════════════
# LIMITES
# ═════════════════════════════════════════════════════════════

TEXTDISPLAY_LIMIT = 4000
TEXTDISPLAY_SAFE_LIMIT = 3900

SELECT_OPTION_LABEL_LIMIT = 100
SELECT_OPTION_DESCRIPTION_LIMIT = 100

BUTTON_LABEL_LIMIT = 80

EMBED_TITLE_LIMIT = 256
EMBED_DESCRIPTION_LIMIT = 4096
EMBED_FIELD_NAME_LIMIT = 256
EMBED_FIELD_VALUE_LIMIT = 1024

DEFAULT_TRUNCATE_SUFFIX = "..."


# ═════════════════════════════════════════════════════════════
# TRUNCAR TEXTO
# ═════════════════════════════════════════════════════════════


def truncate_text(
    text: str,
    max_length: int = TEXTDISPLAY_LIMIT,
    suffix: str = DEFAULT_TRUNCATE_SUFFIX,
) -> str:
    """
    Trunca um texto para não exceder
    o limite especificado.

    Args:
        text:
            Texto a ser truncado.

        max_length:
            Tamanho máximo permitido.
            Padrão: 4000.

        suffix:
            Sufixo adicionado quando houver
            truncamento.
            Padrão: "...".

    Returns:
        Texto original ou truncado.
    """

    if not text:
        return text

    if len(text) <= max_length:
        return text

    truncate_at = (
        max_length
        - len(suffix)
    )

    return (
        text[:truncate_at]
        + suffix
    )


# ═════════════════════════════════════════════════════════════
# TEXT DISPLAY
# ═════════════════════════════════════════════════════════════


def safe_textdisplay(
    text: str,
    max_length: int = TEXTDISPLAY_SAFE_LIMIT,
) -> str:
    """
    Garante que um texto seja seguro
    para uso em TextDisplay.

    Usa 3900 por padrão para manter
    margem de segurança.
    """

    return truncate_text(
        text,
        max_length,
    )


# ═════════════════════════════════════════════════════════════
# SELECT OPTIONS
# ═════════════════════════════════════════════════════════════


def safe_select_option_label(
    text: str,
) -> str:
    """
    Garante que o label de um SelectOption
    tenha no máximo 100 caracteres.
    """

    return truncate_text(
        text,
        SELECT_OPTION_LABEL_LIMIT,
    )


def safe_select_option_description(
    text: str,
) -> str:
    """
    Garante que a descrição de um SelectOption
    tenha no máximo 100 caracteres.
    """

    return truncate_text(
        text,
        SELECT_OPTION_DESCRIPTION_LIMIT,
    )


# ═════════════════════════════════════════════════════════════
# BUTTON
# ═════════════════════════════════════════════════════════════


def safe_button_label(
    text: str,
) -> str:
    """
    Garante que o label de um Button
    tenha no máximo 80 caracteres.
    """

    return truncate_text(
        text,
        BUTTON_LABEL_LIMIT,
    )


# ═════════════════════════════════════════════════════════════
# EMBEDS
# ═════════════════════════════════════════════════════════════


def safe_embed_title(
    text: str,
) -> str:
    """
    Garante que o título de um Embed
    tenha no máximo 256 caracteres.
    """

    return truncate_text(
        text,
        EMBED_TITLE_LIMIT,
    )


def safe_embed_description(
    text: str,
) -> str:
    """
    Garante que a descrição de um Embed
    tenha no máximo 4096 caracteres.
    """

    return truncate_text(
        text,
        EMBED_DESCRIPTION_LIMIT,
    )


def safe_embed_field_name(
    text: str,
) -> str:
    """
    Garante que o nome de um field
    tenha no máximo 256 caracteres.
    """

    return truncate_text(
        text,
        EMBED_FIELD_NAME_LIMIT,
    )


def safe_embed_field_value(
    text: str,
) -> str:
    """
    Garante que o valor de um field
    tenha no máximo 1024 caracteres.
    """

    return truncate_text(
        text,
        EMBED_FIELD_VALUE_LIMIT,
    )


# ═════════════════════════════════════════════════════════════
# QUEBRA DE TEXTO
# ═════════════════════════════════════════════════════════════


def wrap_text(
    text: str,
    max_line_length: int = 50,
) -> str:
    """
    Quebra texto em linhas para melhorar
    a visualização em containers.

    Mantém quebras de linha existentes
    e adiciona novas quando necessário.

    Args:
        text:
            Texto a ser quebrado.

        max_line_length:
            Comprimento máximo de cada linha.
            Padrão: 50.

    Returns:
        Texto com quebras de linha.
    """

    if (
        not text
        or len(text) <= max_line_length
    ):
        return text

    lines = text.split(
        "\n"
    )

    wrapped_lines = []

    # ═════════════════════════════════════════════
    # PROCESSAR CADA LINHA
    # ═════════════════════════════════════════════

    for line in lines:

        if (
            len(line)
            <= max_line_length
        ):
            wrapped_lines.append(
                line
            )
            continue

        words = line.split(
            " "
        )

        current_line = []
        current_length = 0

        # ═════════════════════════════════════════
        # PROCESSAR PALAVRAS
        # ═════════════════════════════════════════

        for word in words:
            word_length = len(
                word
            )

            # ─────────────────────────────────────
            # PALAVRA MAIOR QUE O LIMITE
            # ─────────────────────────────────────

            if (
                word_length
                > max_line_length
            ):
                if current_line:
                    wrapped_lines.append(
                        " ".join(
                            current_line
                        )
                    )

                    current_line = []
                    current_length = 0

                for i in range(
                    0,
                    len(word),
                    max_line_length,
                ):
                    wrapped_lines.append(
                        word[
                            i:
                            i + max_line_length
                        ]
                    )

                continue

            # ─────────────────────────────────────
            # VERIFICAR SE CABE NA LINHA
            # ─────────────────────────────────────

            projected_length = (
                current_length
                + word_length
                + len(current_line)
            )

            if (
                projected_length
                > max_line_length
            ):
                if current_line:
                    wrapped_lines.append(
                        " ".join(
                            current_line
                        )
                    )

                current_line = [
                    word
                ]

                current_length = (
                    word_length
                )

            else:
                current_line.append(
                    word
                )

                current_length += (
                    word_length
                )

        # ═════════════════════════════════════════
        # ÚLTIMA LINHA
        # ═════════════════════════════════════════

        if current_line:
            wrapped_lines.append(
                " ".join(
                    current_line
                )
            )

    return "\n".join(
        wrapped_lines
    )