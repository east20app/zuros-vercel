from zuros_client.models import Application


def test_application_never_keeps_token() -> None:
    app = Application.from_api(
        {
            "id": "1",
            "name": "Bot",
            "botId": "2",
            "token": "secret",
            "status": "active",
            "version": "1.0.0",
        }
    )
    assert app.id == "1"
    assert not hasattr(app, "token")
