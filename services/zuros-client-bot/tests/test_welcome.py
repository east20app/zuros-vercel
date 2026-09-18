from zuros_client.cogs.welcome import WELCOME_TEXT, WelcomeView
from zuros_client.config import Settings


def test_welcome_panel_is_components_v2_with_all_links() -> None:
    settings = Settings(
        discord_token="x" * 32,
        zuros_client_bot_id="client-bot",
        zuros_client_bot_secret="s" * 32,
    )
    view = WelcomeView(settings)
    assert view.has_components_v2()
    container = view.children[0]
    links = container.children[2]  # type: ignore[attr-defined]
    assert [button.label for button in links.children] == [  # type: ignore[attr-defined]
        "Conhecer os planos",
        "Abrir painel",
        "Comunidade e suporte",
    ]


def test_welcome_copy_is_original_to_zuros() -> None:
    assert "ZUROS" in WELCOME_TEXT
    assert "Promisse" not in WELCOME_TEXT
