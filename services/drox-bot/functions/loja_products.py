from typing import Optional

import disnake

from functions.database import database as db
from functions.utils import utils


# ═════════════════════════════════════════════════════════════
# CONSTANTES
# ═════════════════════════════════════════════════════════════

PRODUCTS_DOCUMENT = "loja_products"
CUSTOM_COLORS_DOCUMENT = "custom_colors"

DEFAULT_PRODUCT_ID_LENGTH = 10

ADD_ROLE_REASON = (
    "Compra na loja - adicionar cargos do campo"
)

REMOVE_ROLE_REASON = (
    "Compra na loja - remover cargos do campo"
)


# ═════════════════════════════════════════════════════════════
# STORAGE
# ═════════════════════════════════════════════════════════════


def get_products() -> dict:
    """
    Obtém todos os produtos cadastrados.
    """

    products = db.get_document(
        PRODUCTS_DOCUMENT
    )

    return (
        products
        if isinstance(products, dict)
        else {}
    )


def save_products(
    products: dict,
) -> None:
    """
    Salva todos os produtos.

    Mantém a mesma chamada utilizada atualmente
    pelo banco de dados deste módulo.
    """

    db.save_document(
        PRODUCTS_DOCUMENT,
        products,
    )


def get_product(
    product_id: str,
) -> dict:
    """
    Obtém um produto pelo ID.
    """

    products = get_products()

    product = products.get(
        product_id
    )

    return (
        product
        if isinstance(product, dict)
        else {}
    )


def upsert_product(
    product_id: str,
    product: dict,
) -> None:
    """
    Cria ou atualiza um produto.
    """

    products = get_products()

    products[
        product_id
    ] = product

    save_products(
        products
    )


# ═════════════════════════════════════════════════════════════
# CORES
# ═════════════════════════════════════════════════════════════


def _get_primary_color_hex() -> Optional[str]:
    """
    Obtém a cor primária configurada.
    """

    color_data = (
        db.get_document(
            CUSTOM_COLORS_DOCUMENT
        )
        or {}
    )

    if not isinstance(
        color_data,
        dict,
    ):
        return None

    primary = color_data.get(
        "primary"
    )

    if not primary:
        return None

    return str(
        primary
    )


def _hex_to_int(
    color: str,
) -> int:
    """
    Converte hexadecimal para inteiro.

    Mantém o mesmo formato esperado atualmente:
    #FFFFFF ou FFFFFF.
    """

    return int(
        str(color)
        .replace("#", ""),
        16,
    )


def _get_product_color(
    product: dict,
) -> Optional[int]:
    """
    Obtém a cor do produto.

    Prioridade:
    1. info.hex_color do produto
    2. custom_colors.primary
    """

    info = (
        product.get(
            "info",
            {}
        )
        if isinstance(product, dict)
        else {}
    )

    if not isinstance(
        info,
        dict,
    ):
        info = {}

    hex_color = info.get(
        "hex_color"
    )

    if hex_color:
        return _hex_to_int(
            hex_color
        )

    primary_color = (
        _get_primary_color_hex()
    )

    if primary_color:
        return _hex_to_int(
            primary_color
        )

    return None


# ═════════════════════════════════════════════════════════════
# UI
# ═════════════════════════════════════════════════════════════


def container_kwargs_for_product(
    product: dict,
) -> dict:
    """
    Retorna kwargs visuais para Container.

    A cor personalizada do produto continua
    tendo prioridade sobre a cor global.
    """

    color = _get_product_color(
        product
    )

    if color is None:
        return {}

    return {
        "accent_colour": disnake.Colour(
            color
        )
    }


def embed_kwargs_for_product(
    product: dict,
) -> dict:
    """
    Retorna kwargs visuais para Embed.

    A cor personalizada do produto continua
    tendo prioridade sobre a cor global.
    """

    color = _get_product_color(
        product
    )

    if color is None:
        return {}

    return {
        "color": color
    }


# ═════════════════════════════════════════════════════════════
# PREÇOS
# ═════════════════════════════════════════════════════════════


def parse_price_brl_to_float(
    value: str,
) -> float:
    """
    Converte o formato utilizado atualmente
    para float.

    Exemplos:
        "R$ 10,50" -> 10.50
        "10,50"    -> 10.50

    Em caso de valor inválido, retorna 0.0.
    """

    try:
        if value is None:
            return 0.0

        value_string = (
            str(value)
            .replace("R$", "")
            .replace(" ", "")
            .replace(",", ".")
        )

        return round(
            float(value_string),
            2,
        )

    except Exception:
        return 0.0


def format_price_brl(
    price: float,
) -> str:
    """
    Formata preço em BRL utilizando
    o helper central de utils.
    """

    return utils.format_price_brl(
        float(
            price or 0.0
        )
    )


# ═════════════════════════════════════════════════════════════
# IDS / TEMPO
# ═════════════════════════════════════════════════════════════


def generate_id(
    length: int = DEFAULT_PRODUCT_ID_LENGTH,
) -> str:
    """
    Gera ID utilizando o mesmo helper atual.
    """

    return utils.gerar_id(
        length
    )


def now_ts() -> int:
    """
    Retorna timestamp UTC atual.
    """

    return int(
        disnake.utils.utcnow()
        .timestamp()
    )


# ═════════════════════════════════════════════════════════════
# ESTOQUE
# ═════════════════════════════════════════════════════════════


def get_stock_quantity(
    field: Optional[dict] = None,
    product_id: Optional[str] = None,
    field_id: Optional[str] = None,
) -> int:
    """
    Obtém a quantidade disponível em estoque.

    Suporta os dois sistemas existentes:

    Novo:
        product_id + field_id
        -> StockManager centralizado

    Antigo:
        field["stock"]
        -> list ou dict
    """

    # ═════════════════════════════════════════════
    # ESTOQUE CENTRALIZADO
    # ═════════════════════════════════════════════

    if (
        product_id
        and field_id
    ):
        # Import local mantido para evitar possíveis
        # imports circulares.
        from modules.loja.cart.stock_manager import (
            StockManager,
        )

        return (
            StockManager.get_available_stock(
                product_id,
                field_id,
            )
        )

    # ═════════════════════════════════════════════
    # SISTEMA ANTIGO
    # ═════════════════════════════════════════════

    if not field:
        return 0

    stock = (
        field.get("stock")
        if isinstance(field, dict)
        else None
    )

    if stock is None:
        return 0

    # Estoque armazenado em lista.
    if isinstance(
        stock,
        list,
    ):
        return len(
            stock
        )

    # Estoque armazenado em dict.
    if isinstance(
        stock,
        dict,
    ):
        try:
            return int(
                sum(
                    int(value)
                    for value
                    in stock.values()
                )
            )

        except Exception:
            return len(
                stock.keys()
            )

    return 0


# ═════════════════════════════════════════════════════════════
# EMOJIS
# ═════════════════════════════════════════════════════════════


def validate_emoji_string(
    bot,
    emoji_str: Optional[str],
) -> Optional[str]:
    """
    Valida emoji para uso em componentes
    do Discord.

    Mantém a validação central de:
        utils.validate_emoji_for_components()

    Emoji customizado:
        só retorna caso o bot tenha acesso.

    Emoji Unicode:
        retorna normalmente.
    """

    if not emoji_str:
        return None

    validation = (
        utils.validate_emoji_for_components(
            emoji_str
        )
    )

    if not validation[
        "valid"
    ]:
        return None

    emoji_result = validation[
        "emoji"
    ]

    # ═════════════════════════════════════════════
    # EMOJI CUSTOMIZADO
    # ═════════════════════════════════════════════

    if isinstance(
        emoji_result,
        disnake.PartialEmoji,
    ):
        if emoji_result.id:

            for bot_emoji in getattr(
                bot,
                "emojis",
                [],
            ):
                if (
                    getattr(
                        bot_emoji,
                        "id",
                        None,
                    )
                    == emoji_result.id
                ):
                    return str(
                        emoji_result
                    )

            return None

        return str(
            emoji_result
        )

    # ═════════════════════════════════════════════
    # EMOJI UNICODE
    # ═════════════════════════════════════════════

    return emoji_result


# ═════════════════════════════════════════════════════════════
# CARGOS
# ═════════════════════════════════════════════════════════════


def _parse_role_ids(
    values,
) -> list[int]:
    """
    Converte a lista configurada para IDs válidos.

    Mantém a regra atual:
    somente valores onde str(value).isdigit().
    """

    return [
        int(value)
        for value in (
            values or []
        )
        if str(value).isdigit()
    ]


def _get_manageable_roles(
    guild: disnake.Guild,
    role_ids: list[int],
) -> list[disnake.Role]:
    """
    Resolve IDs em Roles e mantém somente
    cargos que o bot consegue gerenciar.
    """

    me: Optional[
        disnake.Member
    ] = guild.me

    if me is None:
        return []

    if not me.guild_permissions.manage_roles:
        return []

    roles = []

    for role_id in role_ids:
        role = guild.get_role(
            role_id
        )

        if (
            role
            and role < me.top_role
        ):
            roles.append(
                role
            )

    return roles


async def apply_field_roles_after_purchase(
    guild: disnake.Guild,
    member: disnake.Member,
    field: dict,
) -> None:
    """
    Aplica as alterações de cargos configuradas
    no campo após uma compra.

    Mantém o comportamento atual:
    1. adiciona cargos;
    2. remove cargos;
    3. somente cargos gerenciáveis pelo bot;
    4. falhas não interrompem o fluxo da compra.
    """

    if (
        not guild
        or not member
        or not isinstance(
            field,
            dict,
        )
    ):
        return

    cargos = (
        field.get(
            "cargos"
        )
        or {}
    )

    if not isinstance(
        cargos,
        dict,
    ):
        cargos = {}

    # ═════════════════════════════════════════════
    # IDs
    # ═════════════════════════════════════════════

    to_add_ids = (
        _parse_role_ids(
            cargos.get(
                "adicionar"
            )
        )
    )

    to_remove_ids = (
        _parse_role_ids(
            cargos.get(
                "remover"
            )
        )
    )

    # ═════════════════════════════════════════════
    # RESOLVER CARGOS
    # ═════════════════════════════════════════════

    add_roles = (
        _get_manageable_roles(
            guild,
            to_add_ids,
        )
    )

    remove_roles = (
        _get_manageable_roles(
            guild,
            to_remove_ids,
        )
    )

    # ═════════════════════════════════════════════
    # ADICIONAR
    # ═════════════════════════════════════════════

    try:
        if add_roles:
            await member.add_roles(
                *add_roles,
                reason=ADD_ROLE_REASON,
            )

    except Exception:
        # Mantido para não interromper
        # aprovação/processamento da compra.
        pass

    # ═════════════════════════════════════════════
    # REMOVER
    # ═════════════════════════════════════════════

    try:
        if remove_roles:
            await member.remove_roles(
                *remove_roles,
                reason=REMOVE_ROLE_REASON,
            )

    except Exception:
        # Mantido para não interromper
        # aprovação/processamento da compra.
        pass