from zuros_client.cogs.central import CENTRAL_TEXT, CentralView
from zuros_client.config import Settings


def test_central_is_components_v2_and_persistent() -> None:
    settings = Settings(
        discord_token="x" * 32,
        zuros_client_bot_id="client-bot",
        zuros_client_bot_secret="s" * 32,
    )
    view = CentralView(settings)
    assert view.has_components_v2()
    assert view.is_persistent()
    assert "somente para você" in CENTRAL_TEXT


def test_central_has_all_service_actions() -> None:
    settings = Settings(
        discord_token="x" * 32,
        zuros_client_bot_id="client-bot",
        zuros_client_bot_secret="s" * 32,
    )
    view = CentralView(settings)
    container = view.children[0]
    actions = container.children[2]  # type: ignore[attr-defined]
    assert [button.label for button in actions.children] == [  # type: ignore[attr-defined]
        "Aplicações",
        "Comprar",
        "Renovar",
    ]
