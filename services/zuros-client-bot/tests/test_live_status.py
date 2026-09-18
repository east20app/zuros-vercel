from zuros_client.cogs.live_status import status_names


def test_live_status_channel_names() -> None:
    assert status_names(12, 48) == ("🟢 Apps online: 12", "📡 Ping: 48ms")
