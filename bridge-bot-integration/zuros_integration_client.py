"""Cliente assíncrono da API privada ZUROS Integration v1.
Não contém token Discord e nunca registra a credential.
"""

from __future__ import annotations

import asyncio
import json
import secrets
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator

import aiohttp


class ZurosIntegrationError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 500, request_id: str | None = None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.request_id = request_id


@dataclass(slots=True)
class IntegrationEvent:
    id: str | None
    type: str
    data: dict[str, Any]


class ZurosIntegrationClient:
    def __init__(self, base_url: str, credential: str, *, timeout: float = 20.0):
        self.base_url = base_url.rstrip("/") + "/api/integration/v1"
        self._credential = credential.strip()
        self._timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: aiohttp.ClientSession | None = None

    async def start(self):
        if not self._credential:
            raise ZurosIntegrationError("INVALID_CREDENTIAL", "ZUROS_BRIDGE_CREDENTIAL não configurada.", 401)
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self._timeout)
        return self

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
        self._session = None

    async def __aenter__(self):
        return await self.start()

    async def __aexit__(self, *_):
        await self.close()

    def _headers(self, request_id: str | None = None):
        return {
            "Authorization": f"Bearer {self._credential}",
            "Accept": "application/json",
            "X-Request-ID": request_id or str(uuid.uuid4()),
        }

    async def _request(self, method: str, path: str, *, json_body: dict[str, Any] | None = None):
        await self.start()
        assert self._session
        try:
            async with self._session.request(
                method, self.base_url + path, headers=self._headers(), json=json_body
            ) as response:
                request_id = response.headers.get("X-Request-ID")
                payload = await response.json(content_type=None)
                if response.status >= 400 or not payload.get("success", False):
                    error = payload.get("error") or {}
                    raise ZurosIntegrationError(
                        str(error.get("code") or "HTTP_ERROR"),
                        str(error.get("message") or "Falha na integração ZUROS."),
                        response.status,
                        payload.get("request_id") or request_id,
                    )
                return payload.get("data", payload)
        except asyncio.TimeoutError as exc:
            raise ZurosIntegrationError("SERVICE_UNAVAILABLE", "Tempo esgotado ao acessar a ZUROS.", 503) from exc
        except aiohttp.ClientError as exc:
            raise ZurosIntegrationError("SERVICE_UNAVAILABLE", "Não foi possível conectar à ZUROS.", 503) from exc

    async def get_health(self):
        return await self._request("GET", "/health")

    async def get_status(self):
        return await self._request("GET", "/status")

    async def get_stats(self):
        return await self._request("GET", "/stats")

    async def get_config(self):
        return await self._request("GET", "/config")

    async def get_products(self):
        return await self._request("GET", "/products")

    async def heartbeat(self, discord_bot_id: str, guild_id: str, version: str, uptime: int):
        return await self._request(
            "POST",
            "/heartbeat",
            json_body={"discord_bot_id": discord_bot_id, "guild_id": guild_id, "version": version, "uptime": uptime},
        )

    async def create_auth_link(self, auth_id: str, user_id: str, guild_id: str):
        return await self._request(
            "POST", f"/auths/{auth_id}/auth-link", json_body={"user_id": user_id, "guild_id": guild_id}
        )

    async def get_auth_stats(self, auth_id: str):
        return await self._request("GET", f"/auths/{auth_id}/stats")

    async def get_pending_role_sync(self, auth_id: str):
        return await self._request("GET", f"/auths/{auth_id}/role-sync/pending")

    async def ack_role_sync(
        self, auth_id: str, sync_id: str, *, status: str, retryable: bool = False, error_code: str | None = None
    ):
        return await self._request(
            "POST",
            f"/auths/{auth_id}/role-sync/{sync_id}/ack",
            json_body={"status": status, "retryable": retryable, "error_code": error_code},
        )

    async def events(self, auth_id: str, *, last_event_id: str | None = None) -> AsyncIterator[IntegrationEvent]:
        """SSE autenticado. O chamador deve recriar este iterator após falha."""
        await self.start()
        assert self._session
        headers = self._headers()
        headers["Accept"] = "text/event-stream"
        if last_event_id:
            headers["Last-Event-ID"] = last_event_id
        timeout = aiohttp.ClientTimeout(total=None, sock_connect=20, sock_read=90)
        async with self._session.get(
            self.base_url + f"/auths/{auth_id}/events", headers=headers, timeout=timeout
        ) as response:
            if response.status != 200:
                raise ZurosIntegrationError("SSE_REJECTED", f"SSE recusado ({response.status}).", response.status)
            event_id = None
            event_type = "message"
            lines = []
            async for raw in response.content:
                line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                if not line:
                    if lines:
                        try:
                            data = json.loads("\n".join(lines))
                        except json.JSONDecodeError:
                            data = {"raw": "\n".join(lines)}
                        yield IntegrationEvent(
                            event_id, event_type, data if isinstance(data, dict) else {"value": data}
                        )
                    event_id = None
                    event_type = "message"
                    lines = []
                    continue
                if line.startswith(":"):
                    continue
                field, _, value = line.partition(":")
                value = value.lstrip()
                if field == "id":
                    event_id = value
                elif field == "event":
                    event_type = value
                elif field == "data":
                    lines.append(value)


async def reconnecting_events(
    client: ZurosIntegrationClient, auth_id: str, stop: asyncio.Event
) -> AsyncIterator[IntegrationEvent]:
    delays = (5, 7.5, 11.25, 16.8, 25, 37, 56, 60)
    attempt = 0
    last_id = None
    while not stop.is_set():
        try:
            async for event in client.events(auth_id, last_event_id=last_id):
                attempt = 0
                if event.id:
                    last_id = event.id
                yield event
        except (ZurosIntegrationError, aiohttp.ClientError, asyncio.TimeoutError):
            delay = delays[min(attempt, len(delays) - 1)] * (1 + secrets.SystemRandom().uniform(-0.1, 0.1))
            attempt += 1
            try:
                await asyncio.wait_for(stop.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
