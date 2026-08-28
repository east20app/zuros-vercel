import logging
from typing import Optional, Union

import disnake

from functions.database import database as db


logger = logging.getLogger(__name__)


DEFAULT_COLOR = 0x00CBA4

DEFAULT_FOOTER = (
    "Zuros Bot • Excelência em Automação"
)


class ZurosVisuals:
    # ═════════════════════════════════════════════
    # COR
    # ═════════════════════════════════════════════

    @staticmethod
    def _parse_color(
        value,
    ) -> disnake.Colour:
        """
        Converte diferentes formatos de cor
        para disnake.Colour.

        Aceita:
        #00CBA4
        00CBA4
        0x00CBA4
        inteiro
        disnake.Colour
        """

        if isinstance(
            value,
            disnake.Colour,
        ):
            return value

        if isinstance(
            value,
            int,
        ):
            if 0 <= value <= 0xFFFFFF:
                return disnake.Colour(
                    value
                )

            return disnake.Colour(
                DEFAULT_COLOR
            )

        try:
            text = str(
                value
            ).strip()

            text = text.removeprefix(
                "#"
            )

            text = text.removeprefix(
                "0x"
            )

            text = text.removeprefix(
                "0X"
            )

            color_value = int(
                text,
                16,
            )

            if not (
                0 <= color_value <= 0xFFFFFF
            ):
                raise ValueError(
                    "Cor fora do intervalo RGB."
                )

            return disnake.Colour(
                color_value
            )

        except (
            TypeError,
            ValueError,
        ):
            return disnake.Colour(
                DEFAULT_COLOR
            )

    @staticmethod
    def get_color() -> disnake.Colour:
        """
        Obtém a cor primária configurada.
        """

        try:
            color_data = (
                db.get_document(
                    "custom_colors"
                )
                or {}
            )

            if not isinstance(
                color_data,
                dict,
            ):
                color_data = {}

            primary = color_data.get(
                "primary",
                DEFAULT_COLOR,
            )

            return (
                ZurosVisuals._parse_color(
                    primary
                )
            )

        except Exception:
            logger.exception(
                "Erro ao obter cor visual "
                "do Zuros Bot."
            )

            return disnake.Colour(
                DEFAULT_COLOR
            )

    # ═════════════════════════════════════════════
    # EMBED
    # ═════════════════════════════════════════════

    @staticmethod
    def create_embed(
        title: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[
            Union[
                disnake.Colour,
                int,
                str,
            ]
        ] = None,
        thumbnail: Optional[str] = None,
        image: Optional[str] = None,
        footer: Optional[str] = None,
        timestamp: bool = False,
    ) -> disnake.Embed:
        """
        Cria um embed usando o visual padrão
        do bot.
        """

        embed_color = (
            ZurosVisuals._parse_color(
                color
            )
            if color is not None
            else ZurosVisuals.get_color()
        )

        embed = disnake.Embed(
            title=title,
            description=description,
            colour=embed_color,
            timestamp=(
                disnake.utils.utcnow()
                if timestamp
                else None
            ),
        )

        # ═════════════════════════════════════════
        # THUMBNAIL
        # ═════════════════════════════════════════

        if thumbnail:
            try:
                embed.set_thumbnail(
                    url=str(
                        thumbnail
                    )
                )

            except Exception:
                logger.debug(
                    "Thumbnail inválida no embed: %r",
                    thumbnail,
                    exc_info=True,
                )

        # ═════════════════════════════════════════
        # IMAGE
        # ═════════════════════════════════════════

        if image:
            try:
                embed.set_image(
                    url=str(
                        image
                    )
                )

            except Exception:
                logger.debug(
                    "Imagem inválida no embed: %r",
                    image,
                    exc_info=True,
                )

        # ═════════════════════════════════════════
        # FOOTER
        # ═════════════════════════════════════════

        footer_text = (
            footer
            if footer is not None
            else DEFAULT_FOOTER
        )

        if footer_text:
            embed.set_footer(
                text=str(
                    footer_text
                )
            )

        return embed

    # ═════════════════════════════════════════════
    # CONTAINER V2
    # ═════════════════════════════════════════════

    @staticmethod
    def get_container_kwargs() -> dict:
        """
        Retorna argumentos visuais padrão
        para disnake.ui.Container.
        """

        return {
            "accent_colour": (
                ZurosVisuals.get_color()
            )
        }