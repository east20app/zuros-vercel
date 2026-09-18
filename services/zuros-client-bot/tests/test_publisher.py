from zuros_client.cogs.publisher import PANEL_LABELS


def test_publisher_exposes_every_public_panel() -> None:
    assert PANEL_LABELS == {
        "central": "Central ZUROS",
        "aquisicao": "Painel de aquisição",
        "boas-vindas": "Boas-vindas",
    }
