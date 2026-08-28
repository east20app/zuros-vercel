import io
import random
import re
import string
import unicodedata
from urllib.parse import urlparse

import aiohttp
import disnake

from functions.database import database as db


class utils:
    # ═════════════════════════════════════════════════════════
    # CONSTANTES INTERNAS
    # ═════════════════════════════════════════════════════════

    _ASCII_LETTERS_RE = re.compile(
        r"^[a-zA-Z]+$"
    )

    _ASCII_NUMBERS_RE = re.compile(
        r"^\d+$"
    )

    _ASCII_ALNUM_RE = re.compile(
        r"^[a-zA-Z0-9]+$"
    )

    # ═════════════════════════════════════════════════════════
    # HELPERS INTERNOS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def _is_ascii_alnum_only(
        value: str,
    ) -> bool:
        """
        Verifica se todos os caracteres são
        alfanuméricos ASCII.
        """

        if not value:
            return False

        for char in value:
            if (
                not char.isalnum()
                or ord(char) > 127
            ):
                return False

        return True

    @staticmethod
    def _contains_emoji_char(
        value: str,
    ) -> bool:
        """
        Verifica se a string contém pelo menos
        um caractere pertencente aos ranges
        usados atualmente para emojis.
        """

        for char in value:
            code_point = ord(
                char
            )

            if (
                0x1F300 <= code_point <= 0x1F9FF
                or 0x2600 <= code_point <= 0x26FF
                or 0x2700 <= code_point <= 0x27BF
                or 0x1F600 <= code_point <= 0x1F64F
                or 0x1F680 <= code_point <= 0x1F6FF
                or 0x1F1E0 <= code_point <= 0x1F1FF
                or 0x1F900 <= code_point <= 0x1F9FF
                or 0x1FA00 <= code_point <= 0x1FAFF
                or unicodedata.category(char) == "So"
            ):
                return True

        return False

    # ═════════════════════════════════════════════════════════
    # EMOJIS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def get_emoji_from_string(
        emoji_str: str,
    ):
        """
        Tenta converter uma string em um emoji válido.

        Retorna None se o emoji for inválido
        ou não puder ser processado.

        NÃO aceita letras, números ou
        combinações deles.
        """

        if not emoji_str:
            return None

        emoji_str = str(
            emoji_str
        ).strip()

        if not emoji_str:
            return None

        # Formato inválido:
        # :nome:
        if (
            emoji_str.startswith(":")
            and emoji_str.endswith(":")
            and not emoji_str.startswith("<")
        ):
            return None

        # ═════════════════════════════════════════
        # EMOJI CUSTOMIZADO
        # ═════════════════════════════════════════

        try:
            if (
                emoji_str.startswith("<")
                and emoji_str.endswith(">")
            ):
                return (
                    disnake.PartialEmoji.from_str(
                        emoji_str
                    )
                )

        except (
            ValueError,
            TypeError,
            AttributeError,
        ):
            pass

        # Dois-pontos fora do formato customizado.
        if (
            ":"
            in emoji_str
            and not emoji_str.startswith("<")
        ):
            return None

        # ═════════════════════════════════════════
        # REJEITAR TEXTO / NÚMEROS
        # ═════════════════════════════════════════

        if utils._ASCII_LETTERS_RE.match(
            emoji_str
        ):
            return None

        if utils._ASCII_NUMBERS_RE.match(
            emoji_str
        ):
            return None

        if utils._ASCII_ALNUM_RE.match(
            emoji_str
        ):
            return None

        if utils._is_ascii_alnum_only(
            emoji_str
        ):
            return None

        # ═════════════════════════════════════════
        # EMOJI UNICODE
        # ═════════════════════════════════════════

        if not utils._contains_emoji_char(
            emoji_str
        ):
            return None

        try:
            if len(emoji_str) > 50:
                return None

            return disnake.PartialEmoji(
                name=emoji_str
            )

        except (
            ValueError,
            TypeError,
            AttributeError,
        ):
            return None

    @staticmethod
    def safe_get_emoji(
        emoji_str: str,
        default=None,
    ):
        """
        Versão segura de get_emoji_from_string.

        Sempre retorna o emoji processado
        ou o valor default.
        """

        try:
            result = (
                utils.get_emoji_from_string(
                    emoji_str
                )
            )

            return (
                result
                if result is not None
                else default
            )

        except Exception:
            return default

    @staticmethod
    def validate_emoji_for_components(
        emoji_str: str,
    ) -> dict:
        """
        Valida se um emoji pode ser usado em
        componentes do Discord.

        Mantém exatamente o formato atual
        de retorno:

        {
            "valid": bool,
            "emoji": ...,
            "error": str | None,
            "original": str
        }
        """

        if not emoji_str:
            return {
                "valid": False,
                "emoji": None,
                "error": "Emoji vazio",
                "original": "",
            }

        emoji_str = str(
            emoji_str
        ).strip()

        original = emoji_str

        if not emoji_str:
            return {
                "valid": False,
                "emoji": None,
                "error": "Emoji vazio",
                "original": original,
            }

        # ═════════════════════════════════════════
        # EMOJI CUSTOMIZADO
        # ═════════════════════════════════════════

        if (
            emoji_str.startswith("<")
            and emoji_str.endswith(">")
        ):
            try:
                partial_emoji = (
                    disnake.PartialEmoji.from_str(
                        emoji_str
                    )
                )

                if partial_emoji.id is None:
                    return {
                        "valid": False,
                        "emoji": None,
                        "error": (
                            "Emoji customizado precisa "
                            "ter um ID válido"
                        ),
                        "original": original,
                    }

                if not (
                    emoji_str.startswith("<:")
                    or emoji_str.startswith("<a:")
                ):
                    return {
                        "valid": False,
                        "emoji": None,
                        "error": (
                            "Formato inválido. "
                            "Use <:nome:id> ou <a:nome:id>"
                        ),
                        "original": original,
                    }

                if (
                    not partial_emoji.name
                    or not partial_emoji.id
                ):
                    return {
                        "valid": False,
                        "emoji": None,
                        "error": (
                            "Emoji customizado precisa "
                            "ter nome e ID"
                        ),
                        "original": original,
                    }

                return {
                    "valid": True,
                    "emoji": partial_emoji,
                    "error": None,
                    "original": original,
                }

            except (
                ValueError,
                TypeError,
                AttributeError,
            ) as error:
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Formato de emoji customizado "
                        f"inválido: {str(error)}"
                    ),
                    "original": original,
                }

        # ═════════════════════════════════════════
        # EMOJI UNICODE
        # ═════════════════════════════════════════

        try:
            # Formato :nome:
            if (
                emoji_str.startswith(":")
                and emoji_str.endswith(":")
                and len(emoji_str) > 2
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Formato inválido. "
                        "Use um emoji unicode "
                        "ou <:nome:id>"
                    ),
                    "original": original,
                }

            if (
                ":"
                in emoji_str
                and not emoji_str.startswith("<")
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Formato inválido. "
                        "Use um emoji unicode "
                        "ou <:nome:id>"
                    ),
                    "original": original,
                }

            # ─────────────────────────────────────
            # LETRAS
            # ─────────────────────────────────────

            if utils._ASCII_LETTERS_RE.match(
                emoji_str
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Não é um emoji válido. "
                        "Não aceita apenas letras."
                    ),
                    "original": original,
                }

            # ─────────────────────────────────────
            # NÚMEROS
            # ─────────────────────────────────────

            if utils._ASCII_NUMBERS_RE.match(
                emoji_str
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Não é um emoji válido. "
                        "Não aceita apenas números."
                    ),
                    "original": original,
                }

            # ─────────────────────────────────────
            # LETRAS + NÚMEROS
            # ─────────────────────────────────────

            if utils._ASCII_ALNUM_RE.match(
                emoji_str
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Não é um emoji válido. "
                        "Não aceita apenas letras "
                        "e números."
                    ),
                    "original": original,
                }

            if utils._is_ascii_alnum_only(
                emoji_str
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Não é um emoji válido. "
                        "Não aceita apenas letras "
                        "e números."
                    ),
                    "original": original,
                }

            # ─────────────────────────────────────
            # COMPRIMENTO
            # ─────────────────────────────────────

            if len(emoji_str) > 50:
                return {
                    "valid": False,
                    "emoji": None,
                    "error": "Emoji muito longo",
                    "original": original,
                }

            # ─────────────────────────────────────
            # RANGE UNICODE
            # ─────────────────────────────────────

            if not utils._contains_emoji_char(
                emoji_str
            ):
                return {
                    "valid": False,
                    "emoji": None,
                    "error": (
                        "Não é um emoji válido. "
                        "Use um emoji unicode "
                        "ou <:nome:id>"
                    ),
                    "original": original,
                }

            return {
                "valid": True,
                "emoji": emoji_str,
                "error": None,
                "original": original,
            }

        except Exception as error:
            return {
                "valid": False,
                "emoji": None,
                "error": (
                    "Erro ao validar emoji: "
                    f"{str(error)}"
                ),
                "original": original,
            }

    # ═════════════════════════════════════════════════════════
    # IDS
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def gerar_id(
        tamanho: int = 10,
    ):
        return "".join(
            random.choices(
                string.ascii_letters
                + string.digits,
                k=tamanho,
            )
        )

    # ═════════════════════════════════════════════════════════
    # SERVIDOR
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def obter_server_principal():
        return int(
            db.obter(
                "config.json"
            )["bot"]["server"]
        )

    # ═════════════════════════════════════════════════════════
    # URL
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def is_valid_url(
        url: str,
    ) -> bool:
        if (
            not url
            or not isinstance(
                url,
                str,
            )
        ):
            return False

        try:
            parsed = urlparse(
                url
            )

            return bool(
                parsed.scheme
                in (
                    "http",
                    "https",
                )
                and parsed.netloc
            )

        except Exception:
            return False

    # ═════════════════════════════════════════════════════════
    # CORES
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def normalize_hex_color(
        hex_str: str,
    ):
        """
        Normaliza hexadecimal mantendo
        exatamente o comportamento atual.

        Exemplos:
        FFFFFF -> #ffffff
        #ABC -> #abc
        """

        if (
            not hex_str
            or not isinstance(
                hex_str,
                str,
            )
        ):
            return None

        value = hex_str.strip()

        if not value:
            return None

        if value.startswith("#"):
            value = value[1:]

        if len(value) not in (
            3,
            6,
        ):
            return None

        try:
            int(
                value,
                16,
            )

        except ValueError:
            return None

        return (
            f"#{value.lower()}"
        )

    # ═════════════════════════════════════════════════════════
    # TIMESTAMP
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def format_timestamp(
        timestamp: int | None,
    ) -> str:
        try:
            ts = (
                int(timestamp)
                if timestamp is not None
                else None
            )

            if (
                not ts
                or ts <= 0
            ):
                return "Nunca"

            return (
                f"<t:{ts}:f> "
                f"(<t:{ts}:R>)"
            )

        except Exception:
            return "Nunca"

    # ═════════════════════════════════════════════════════════
    # TEXTO
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def wrap_text_hyphenate(
        text: str,
        max_width: int = 40,
    ) -> str:
        """
        Quebra texto respeitando a largura
        configurada e adiciona hífen em palavras
        maiores que o limite.
        """

        if not text:
            return ""

        try:
            width = int(
                max_width
            )

        except Exception:
            width = 40

        if width <= 1:
            return str(
                text
            )

        output_lines = []

        for paragraph in str(
            text
        ).splitlines():

            # Preserva linhas vazias.
            if paragraph.strip() == "":
                output_lines.append(
                    ""
                )
                continue

            current_line = ""

            words = paragraph.split(
                " "
            )

            for word in words:

                # Preserva múltiplos espaços.
                if word == "":
                    if (
                        current_line
                        and len(current_line) + 1
                        <= width
                    ):
                        current_line += " "

                    elif not current_line:
                        current_line = " "

                    continue

                # ═════════════════════════════════
                # PALAVRA MAIOR QUE O LIMITE
                # ═════════════════════════════════

                if len(word) > width:

                    if current_line:
                        output_lines.append(
                            current_line
                        )

                        current_line = ""

                    remaining = word

                    while (
                        len(remaining)
                        > width
                    ):
                        chunk = remaining[
                            : width - 1
                        ]

                        output_lines.append(
                            chunk + "-"
                        )

                        remaining = remaining[
                            width - 1 :
                        ]

                    if remaining:
                        current_line = remaining

                    continue

                # ═════════════════════════════════
                # PALAVRA NORMAL
                # ═════════════════════════════════

                if not current_line:
                    current_line = word

                elif (
                    len(current_line)
                    + 1
                    + len(word)
                    <= width
                ):
                    current_line += (
                        " " + word
                    )

                else:
                    output_lines.append(
                        current_line
                    )

                    current_line = word

            if current_line:
                output_lines.append(
                    current_line
                )

        return "\n".join(
            output_lines
        )

    # ═════════════════════════════════════════════════════════
    # PREÇO
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def format_price_brl(
        price: float,
    ) -> str:
        return (
            f"R$ {price:.2f}"
            .replace(
                ".",
                ",",
            )
        )

    # ═════════════════════════════════════════════════════════
    # EMBED
    # ═════════════════════════════════════════════════════════

    @staticmethod
    def normalize_embed_data(
        embed_data: dict,
    ) -> dict:
        """
        Normaliza os dados do embed para
        disnake.Embed.from_dict().

        Mantém:
        - color hexadecimal -> int
        - image_url -> image.url
        - thumbnail_url -> thumbnail.url
        """

        if (
            not embed_data
            or not isinstance(
                embed_data,
                dict,
            )
        ):
            return embed_data

        # Não modifica o objeto original.
        normalized = (
            embed_data.copy()
        )

        # ═════════════════════════════════════════
        # COLOR
        # ═════════════════════════════════════════

        if "color" in normalized:

            color_value = (
                normalized["color"]
            )

            if isinstance(
                color_value,
                str,
            ):
                hex_color = (
                    color_value.strip()
                )

                if hex_color.startswith(
                    "#"
                ):
                    hex_color = (
                        hex_color[1:]
                    )

                try:
                    normalized[
                        "color"
                    ] = int(
                        hex_color,
                        16,
                    )

                except (
                    ValueError,
                    TypeError,
                ):
                    del normalized[
                        "color"
                    ]

            elif color_value is None:
                del normalized[
                    "color"
                ]

        # ═════════════════════════════════════════
        # IMAGE
        # ═════════════════════════════════════════

        if "image_url" in normalized:
            image_url = (
                normalized.pop(
                    "image_url"
                )
            )

            if image_url:
                normalized[
                    "image"
                ] = {
                    "url": image_url
                }

        # ═════════════════════════════════════════
        # THUMBNAIL
        # ═════════════════════════════════════════

        if "thumbnail_url" in normalized:
            thumbnail_url = (
                normalized.pop(
                    "thumbnail_url"
                )
            )

            if thumbnail_url:
                normalized[
                    "thumbnail"
                ] = {
                    "url": thumbnail_url
                }

        return normalized

    # ═════════════════════════════════════════════════════════
    # URL → DISNAKE FILE
    # ═════════════════════════════════════════════════════════

    @staticmethod
    async def url_to_file(
        url: str,
        filename: str = "image.png",
    ) -> disnake.File:
        """
        Baixa uma imagem de uma URL e retorna
        como disnake.File.

        Mantém o mesmo comportamento atual:
        status 200 retorna o arquivo;
        outros status geram Exception.
        """

        async with aiohttp.ClientSession() as session:

            async with session.get(
                url
            ) as response:

                if response.status == 200:

                    data = await response.read()

                    return disnake.File(
                        io.BytesIO(
                            data
                        ),
                        filename=filename,
                    )

                raise Exception(
                    "Falha ao baixar imagem: "
                    f"Status {response.status}"
                )