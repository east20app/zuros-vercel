import asyncio
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass(slots=True)
class TicketConfig:
    guild_id: int
    category_id: int
    support_role_id: int
    log_channel_id: int
    panel_channel_id: int


@dataclass(slots=True)
class TicketRecord:
    channel_id: int
    guild_id: int
    owner_id: int
    department: str
    subject: str
    status: str
    claimed_by: int | None
    created_at: str
    closed_at: str | None
    closed_by: int | None
    close_reason: str | None


class TicketStore:
    def __init__(self, path: str):
        self.path = Path(path)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as database:
            database.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS ticket_configs (
                    guild_id INTEGER PRIMARY KEY,
                    category_id INTEGER NOT NULL,
                    support_role_id INTEGER NOT NULL,
                    log_channel_id INTEGER NOT NULL,
                    panel_channel_id INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tickets (
                    channel_id INTEGER PRIMARY KEY,
                    guild_id INTEGER NOT NULL,
                    owner_id INTEGER NOT NULL,
                    department TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    claimed_by INTEGER,
                    created_at TEXT NOT NULL,
                    closed_at TEXT,
                    closed_by INTEGER,
                    close_reason TEXT
                );
                CREATE UNIQUE INDEX IF NOT EXISTS one_open_ticket_per_member
                ON tickets(guild_id, owner_id) WHERE status = 'open';
                """
            )

    async def save_config(self, config: TicketConfig) -> None:
        await asyncio.to_thread(self._save_config, config)

    def _save_config(self, config: TicketConfig) -> None:
        with self._connect() as database:
            database.execute(
                """INSERT INTO ticket_configs VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET
                category_id=excluded.category_id,
                support_role_id=excluded.support_role_id,
                log_channel_id=excluded.log_channel_id,
                panel_channel_id=excluded.panel_channel_id""",
                (
                    config.guild_id,
                    config.category_id,
                    config.support_role_id,
                    config.log_channel_id,
                    config.panel_channel_id,
                ),
            )

    async def get_config(self, guild_id: int) -> TicketConfig | None:
        return await asyncio.to_thread(self._get_config, guild_id)

    def _get_config(self, guild_id: int) -> TicketConfig | None:
        with self._connect() as database:
            row = database.execute(
                "SELECT * FROM ticket_configs WHERE guild_id = ?", (guild_id,)
            ).fetchone()
        return TicketConfig(**dict(row)) if row else None

    async def create_ticket(
        self, channel_id: int, guild_id: int, owner_id: int, department: str, subject: str
    ) -> TicketRecord:
        return await asyncio.to_thread(
            self._create_ticket, channel_id, guild_id, owner_id, department, subject
        )

    def _create_ticket(
        self, channel_id: int, guild_id: int, owner_id: int, department: str, subject: str
    ) -> TicketRecord:
        created_at = datetime.now(UTC).isoformat()
        with self._connect() as database:
            database.execute(
                "INSERT INTO tickets(channel_id,guild_id,owner_id,department,subject,created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (channel_id, guild_id, owner_id, department, subject, created_at),
            )
        return TicketRecord(
            channel_id,
            guild_id,
            owner_id,
            department,
            subject,
            "open",
            None,
            created_at,
            None,
            None,
            None,
        )

    async def get_ticket(self, channel_id: int) -> TicketRecord | None:
        return await asyncio.to_thread(self._get_ticket, channel_id)

    def _get_ticket(self, channel_id: int) -> TicketRecord | None:
        with self._connect() as database:
            row = database.execute(
                "SELECT * FROM tickets WHERE channel_id = ?", (channel_id,)
            ).fetchone()
        return TicketRecord(**dict(row)) if row else None

    async def get_open_ticket(self, guild_id: int, owner_id: int) -> TicketRecord | None:
        return await asyncio.to_thread(self._get_open_ticket, guild_id, owner_id)

    def _get_open_ticket(self, guild_id: int, owner_id: int) -> TicketRecord | None:
        with self._connect() as database:
            row = database.execute(
                "SELECT * FROM tickets WHERE guild_id=? AND owner_id=? AND status='open'",
                (guild_id, owner_id),
            ).fetchone()
        return TicketRecord(**dict(row)) if row else None

    async def claim(self, channel_id: int, user_id: int) -> None:
        await asyncio.to_thread(self._update, channel_id, "claimed_by", user_id)

    async def close(self, channel_id: int, user_id: int, reason: str) -> None:
        await asyncio.to_thread(self._close, channel_id, user_id, reason)

    def _close(self, channel_id: int, user_id: int, reason: str) -> None:
        with self._connect() as database:
            database.execute(
                "UPDATE tickets SET status='closed',closed_at=?,closed_by=?,close_reason=? "
                "WHERE channel_id=?",
                (datetime.now(UTC).isoformat(), user_id, reason, channel_id),
            )

    async def reopen(self, channel_id: int) -> None:
        await asyncio.to_thread(self._reopen, channel_id)

    def _reopen(self, channel_id: int) -> None:
        with self._connect() as database:
            database.execute(
                "UPDATE tickets SET status='open',closed_at=NULL,closed_by=NULL,close_reason=NULL "
                "WHERE channel_id=?",
                (channel_id,),
            )

    async def delete(self, channel_id: int) -> None:
        await asyncio.to_thread(self._update, channel_id, "status", "deleted")

    def _update(self, channel_id: int, field: str, value: object) -> None:
        allowed = {"claimed_by", "status"}
        if field not in allowed:
            raise ValueError("Campo de ticket inválido")
        with self._connect() as database:
            database.execute(
                f"UPDATE tickets SET {field}=? WHERE channel_id=?", (value, channel_id)
            )
