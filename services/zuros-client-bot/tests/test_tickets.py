import sqlite3
from pathlib import Path
from uuid import uuid4

import pytest

from zuros_client.cogs.tickets import (
    DEPARTMENTS,
    TicketControlView,
    TicketPanelView,
)
from zuros_client.tickets.store import TicketConfig, TicketStore


@pytest.mark.asyncio
async def test_ticket_store_persists_configuration_and_lifecycle() -> None:
    database = Path(__file__).with_name(f".ticket-test-{uuid4().hex}.sqlite3")
    try:
        store = TicketStore(str(database))
        await store.initialize()
        config = TicketConfig(1, 2, 3, 4, 5)
        await store.save_config(config)
        assert await store.get_config(1) == config

        ticket = await store.create_ticket(10, 1, 20, "support", "Preciso de ajuda")
        assert ticket.status == "open"
        assert (await store.get_open_ticket(1, 20)).channel_id == 10  # type: ignore[union-attr]

        with pytest.raises(sqlite3.IntegrityError):
            await store.create_ticket(11, 1, 20, "billing", "Pagamento")

        await store.claim(10, 30)
        assert (await store.get_ticket(10)).claimed_by == 30  # type: ignore[union-attr]
        await store.close(10, 30, "Resolvido")
        assert (await store.get_ticket(10)).status == "closed"  # type: ignore[union-attr]
        await store.reopen(10)
        assert (await store.get_ticket(10)).status == "open"  # type: ignore[union-attr]
    finally:
        database.unlink(missing_ok=True)


def test_ticket_panels_are_persistent_components_v2() -> None:
    panel = TicketPanelView()
    controls = TicketControlView()
    assert panel.has_components_v2()
    assert controls.has_components_v2()
    assert panel.is_persistent()
    assert controls.is_persistent()
    assert set(DEPARTMENTS) == {"support", "billing", "sales"}
