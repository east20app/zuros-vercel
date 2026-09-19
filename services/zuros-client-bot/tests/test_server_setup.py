from zuros_client.cogs.server_setup import (
    CATEGORY_SPECS,
    CHANNEL_SPECS,
    ROLE_SPECS,
    VOICE_CHANNEL_SPECS,
)


def test_server_setup_has_complete_structure() -> None:
    assert [role[0] for role in ROLE_SPECS] == [
        "ZUROS Admin",
        "ZUROS Suporte",
        "Cliente ZUROS",
    ]
    assert CATEGORY_SPECS == ("COMECE AQUI", "ATENDIMENTO", "TICKETS", "STATUS ZUROS")
    assert [channel[0] for channel in CHANNEL_SPECS] == [
        "boas-vindas",
        "central-zuros",
        "adquirir",
        "suporte",
        "abrir-ticket",
        "logs-tickets",
    ]
    assert VOICE_CHANNEL_SPECS == ("🟢 Apps online: 0", "📡 Ping: 0ms")


def test_every_channel_references_an_existing_category() -> None:
    assert all(channel[1] in CATEGORY_SPECS for channel in CHANNEL_SPECS)
