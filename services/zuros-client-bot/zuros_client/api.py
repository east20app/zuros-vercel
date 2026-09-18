import asyncio
import logging
import random
import socket
from collections.abc import Mapping
from typing import Any, TypeVar

import aiohttp

from .config import Settings
from .errors import ERRORS, ZurosApiError
from .models import Application, Guild, Plan, Product
from .security import canonical_query, encode_body, signed_headers

T = TypeVar("T")
log = logging.getLogger(__name__)


class ZurosClientApi:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._session: aiohttp.ClientSession | None = None

    async def start(self) -> None:
        if not self._session or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.settings.http_timeout_seconds)
            # Some bot hosts advertise IPv6 without providing a working IPv6
            # route. The public ZUROS endpoint supports IPv4, so forcing it
            # avoids misleading connection timeouts on those hosts.
            connector = aiohttp.TCPConnector(family=socket.AF_INET, ttl_dns_cache=300)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                raise_for_status=False,
                headers={"User-Agent": "ZUROS-Client-Bot/1.0"},
            )

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, object] | None = None,
        json: Mapping[str, object] | None = None,
    ) -> dict[str, Any]:
        await self.start()
        body = encode_body(json)
        query_string = canonical_query(query)
        url = f"{self.settings.api_root}/{path.lstrip('/')}" + (
            f"?{query_string}" if query_string else ""
        )
        attempts = 3 if method.upper() == "GET" else 1
        for attempt in range(attempts):
            # Every attempt needs its own nonce. Reusing one can correctly be
            # rejected by the API as a replay when the first response is lost.
            headers = signed_headers(
                method=method,
                path=path,
                query=query,
                body=body,
                secret=self.settings.zuros_client_bot_secret.get_secret_value(),
                bot_id=self.settings.zuros_client_bot_id,
            )
            try:
                assert self._session
                async with self._session.request(
                    method, url, data=body or None, headers=headers
                ) as response:
                    request_id = response.headers.get("X-Request-ID", "")
                    try:
                        payload = await response.json(content_type=None)
                    except Exception as error:
                        raise ZurosApiError(
                            "A API retornou uma resposta inválida.",
                            status=response.status,
                            request_id=request_id,
                        ) from error
                    if 200 <= response.status < 300:
                        return payload.get("data", payload) if isinstance(payload, dict) else {}
                    detail = payload.get("error", {}) if isinstance(payload, dict) else {}
                    error_type = ERRORS.get(response.status, ZurosApiError)
                    raise error_type(
                        str(detail.get("message") or "Não foi possível concluir a operação."),
                        status=response.status,
                        code=str(detail.get("code") or "API_ERROR"),
                        request_id=str(
                            payload.get("request_id") or payload.get("requestId") or request_id
                        ),
                    )
            except (TimeoutError, aiohttp.ClientError) as error:
                log.warning("Falha ao acessar %s: %s: %s", url, type(error).__name__, error)
                if attempt + 1 >= attempts:
                    if isinstance(error, TimeoutError):
                        message = "A conexão com a API ZUROS excedeu o tempo limite."
                        code = "API_TIMEOUT"
                    elif isinstance(error, aiohttp.ClientConnectorCertificateError):
                        message = "O certificado de segurança da API ZUROS foi recusado."
                        code = "API_TLS_ERROR"
                    elif isinstance(error, aiohttp.ClientConnectorDNSError):
                        message = "O endereço app.zuros.site não pôde ser encontrado pelo DNS."
                        code = "API_DNS_ERROR"
                    elif isinstance(error, aiohttp.ClientConnectorError):
                        detail = str(error.os_error or error)
                        message = f"Não foi possível conectar à API ZUROS: {detail}"
                        code = "API_CONNECTION_ERROR"
                    else:
                        message = f"Falha de rede ao acessar a API ZUROS: {type(error).__name__}."
                        code = "API_NETWORK_ERROR"
                    raise ZurosApiError(message, status=503, code=code) from error
                await asyncio.sleep((2**attempt) * 0.4 + random.random() * 0.2)
        raise ZurosApiError("Não foi possível acessar a API.", status=503)

    async def health(self) -> dict[str, Any]:
        return await self.request("GET", "status")

    async def list_applications(self, user_id: str) -> list[Application]:
        data = await self.request("GET", "applications", query={"discord_user_id": user_id})
        return [Application.from_api(item) for item in data.get("applications", [])]

    async def get_application(self, user_id: str, app_id: str) -> Application:
        return Application.from_api(
            await self.request("GET", f"applications/{app_id}", query={"discord_user_id": user_id})
        )

    async def list_guilds(self, user_id: str, app_id: str) -> list[Guild]:
        data = await self.request(
            "GET", f"applications/{app_id}/guilds", query={"discord_user_id": user_id}
        )
        return [
            Guild(id=str(item.get("id")), name=str(item.get("name") or item.get("id")))
            for item in data.get("guilds", [])
        ]

    async def operate(self, user_id: str, app_id: str, action: str) -> None:
        await self.request(
            "POST", f"applications/{app_id}/{action}", json={"discord_user_id": user_id}
        )

    async def rename(self, user_id: str, app_id: str, name: str) -> None:
        await self.request(
            "PATCH", f"applications/{app_id}", json={"discord_user_id": user_id, "name": name}
        )

    async def update_token(self, user_id: str, app_id: str, token: str) -> None:
        await self.request(
            "PATCH",
            f"applications/{app_id}/token",
            json={"discord_user_id": user_id, "token": token},
        )

    async def set_main_guild(self, user_id: str, app_id: str, guild_id: str) -> None:
        await self.request(
            "PATCH",
            f"applications/{app_id}/main-server",
            json={"discord_user_id": user_id, "guild_id": guild_id},
        )

    async def renew(self, user_id: str, app_id: str, plan_id: str) -> dict[str, Any]:
        return await self.request(
            "POST",
            f"applications/{app_id}/renewal-cart",
            json={"discord_user_id": user_id, "plan_id": plan_id},
        )

    async def catalog(self) -> list[Product]:
        data = await self.request("GET", "catalog")
        return [
            Product(
                id=str(item["id"]),
                store_id=str(item["storeId"]),
                name=str(item["name"]),
                description=str(item.get("description") or ""),
                plans=[
                    Plan(
                        id=str(plan["id"]),
                        label=str(plan["label"]),
                        price=float(plan["price"]),
                        lifetime=bool(plan.get("lifetime")),
                    )
                    for plan in item.get("plans", [])
                ],
            )
            for item in data.get("products", [])
        ]

    async def create_purchase(
        self, user_id: str, store_id: str, product_id: str, plan_id: str
    ) -> dict[str, Any]:
        return await self.request(
            "POST",
            "carts",
            json={
                "discord_user_id": user_id,
                "store_id": store_id,
                "product_id": product_id,
                "plan_id": plan_id,
            },
        )

    async def create_payment(self, user_id: str, cart_id: str) -> dict[str, Any]:
        return await self.request(
            "POST", f"carts/{cart_id}/payment", json={"discord_user_id": user_id}
        )
