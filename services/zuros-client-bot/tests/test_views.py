from zuros_client.api import ZurosClientApi
from zuros_client.config import Settings
from zuros_client.models import Application
from zuros_client.views.apps import ApplicationView


def build_view(*, online: bool) -> ApplicationView:
    settings = Settings(
        discord_token="x" * 32,
        zuros_client_bot_id="client-bot",
        zuros_client_bot_secret="s" * 32,
    )
    application = Application(
        id="application-id",
        name="Minha aplicação",
        bot_id="123456789012345678",
        status="active",
        version="1.0.0",
        lifetime=False,
        expires_at=None,
        server_id=None,
        online=online,
        force_update=False,
    )
    return ApplicationView(ZurosClientApi(settings), settings, 1, application)


def operation_states(view: ApplicationView) -> dict[str, bool]:
    container = view.children[0]
    row = container.children[2]  # type: ignore[attr-defined]
    return {button.label: button.disabled for button in row.children}  # type: ignore[attr-defined]


def test_online_application_disables_start_only() -> None:
    states = operation_states(build_view(online=True))
    assert states["Iniciar"] is True
    assert states["Reiniciar"] is False
    assert states["Desligar"] is False


def test_offline_application_only_allows_start() -> None:
    states = operation_states(build_view(online=False))
    assert states["Iniciar"] is False
    assert states["Reiniciar"] is True
    assert states["Desligar"] is True
