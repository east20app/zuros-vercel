from zuros_client.api import ZurosClientApi
from zuros_client.cogs.acquisition import AcquisitionView, acquisition_text
from zuros_client.config import Settings
from zuros_client.models import Plan, Product


def fixtures() -> tuple[Settings, list[Product]]:
    settings = Settings(
        discord_token="x" * 32,
        zuros_client_bot_id="client-bot",
        zuros_client_bot_secret="s" * 32,
    )
    products = [
        Product(
            id="sales-bot",
            store_id="store",
            name="Bot de Vendas",
            description="Automatize seu catálogo e suas entregas.",
            plans=[Plan(id="monthly", label="Mensal", price=49.9)],
        )
    ]
    return settings, products


def test_acquisition_panel_uses_real_catalog_and_components_v2() -> None:
    settings, products = fixtures()
    view = AcquisitionView(ZurosClientApi(settings), settings, products)
    assert view.has_components_v2()
    assert view.is_persistent()
    assert "Bot de Vendas" in acquisition_text(products)


def test_acquisition_menu_contains_product_id() -> None:
    settings, products = fixtures()
    view = AcquisitionView(ZurosClientApi(settings), settings, products)
    container = view.children[0]
    row = container.children[2]  # type: ignore[attr-defined]
    select = row.children[0]  # type: ignore[attr-defined]
    assert select.options[0].value == "sales-bot"  # type: ignore[attr-defined]
