from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class Application:
    id: str
    name: str
    bot_id: str
    status: str
    version: str
    lifetime: bool
    expires_at: str | None
    server_id: str | None
    online: bool
    force_update: bool

    @classmethod
    def from_api(cls, raw: dict[str, Any]) -> "Application":
        return cls(
            id=str(raw.get("id") or raw.get("application_id") or ""),
            name=str(raw.get("name") or "Aplicação"),
            bot_id=str(raw.get("botId") or raw.get("bot_id") or ""),
            status=str(raw.get("status") or "unknown"),
            version=str(raw.get("version") or "1.0.0"),
            lifetime=bool(raw.get("lifetime")),
            expires_at=str(raw["expiresAt"]) if raw.get("expiresAt") else None,
            server_id=str(raw["serverId"]) if raw.get("serverId") else None,
            online=bool(raw.get("online")),
            force_update=bool(raw.get("forceUpdate")),
        )


@dataclass(slots=True)
class Guild:
    id: str
    name: str


@dataclass(slots=True)
class Plan:
    id: str
    label: str
    price: float
    lifetime: bool = False


@dataclass(slots=True)
class Product:
    id: str
    store_id: str
    name: str
    description: str
    plans: list[Plan]
