"""Cliente assíncrono para o contrato interno oficial da Zuros Auth."""
from __future__ import annotations
import asyncio, logging, os
from dataclasses import dataclass
from typing import Any, Mapping
import aiohttp
LOGGER = logging.getLogger(__name__)
DEFAULT_BACKEND_URL = "https://zuros-auth.vercel.app"
class ZurosError(RuntimeError): pass
class ZurosConfigurationError(ZurosError): pass
class ZurosAuthenticationError(ZurosError): pass
class ZurosUnavailableError(ZurosError): pass
class ZurosResponseError(ZurosError): pass

@dataclass(frozen=True, slots=True)
class ZurosSettings:
    backend_url: str
    auth_id: str
    bot_credential: str
    gateway_secret: str = ""
    timeout_seconds: float = 15.0
    @classmethod
    def from_env(cls):
        return cls((os.getenv("ZUROS_BACKEND_URL") or DEFAULT_BACKEND_URL).rstrip("/"),
                   (os.getenv("ZUROS_AUTH_ID") or "").strip(),
                   (os.getenv("ZUROS_BOT_CREDENTIAL") or "").strip(),
                   (os.getenv("BOT_GATEWAY_SHARED_SECRET") or "").strip())
    @property
    def configured(self): return bool(self.auth_id and self.bot_credential)
    def validate(self):
        missing = [k for k,v in (("ZUROS_AUTH_ID",self.auth_id),
                                  ("ZUROS_BOT_CREDENTIAL",self.bot_credential)) if not v]
        if missing: raise ZurosConfigurationError("Variáveis ausentes: " + ", ".join(missing))

@dataclass(frozen=True, slots=True)
class AuthLink: url: str
@dataclass(frozen=True, slots=True)
class VerificationResult:
    verified: bool
    payload: Mapping[str, Any]
@dataclass(frozen=True, slots=True)
class RoleSyncItem:
    id: str
    guild_id: int
    discord_user_id: int
    verified_role_id: int
    action: str

class ZurosClient:
    """Uma instância e uma ClientSession por bot."""
    def __init__(self, settings: ZurosSettings, *, session=None):
        self.settings, self._session = settings, session
        self._owns_session, self._lock = session is None, asyncio.Lock()
    async def _get_session(self):
        if self._session is None or self._session.closed:
            async with self._lock:
                if self._session is None or self._session.closed:
                    self._session = aiohttp.ClientSession(
                        timeout=aiohttp.ClientTimeout(total=self.settings.timeout_seconds))
                    self._owns_session = True
        return self._session
    async def close(self):
        if self._owns_session and self._session and not self._session.closed:
            await self._session.close()
    def _headers(self):
        self.settings.validate()
        return {"X-Auth-Id":self.settings.auth_id,
                "X-Bot-Credential":self.settings.bot_credential}
    async def _request(self, method, path, *, headers=None, retries=2, **kwargs):
        session, request_headers = await self._get_session(), dict(headers or self._headers())
        for attempt in range(retries + 1):
            try:
                async with session.request(method, self.settings.backend_url + path,
                                           headers=request_headers, **kwargs) as response:
                    try: data = await response.json(content_type=None)
                    except (aiohttp.ContentTypeError, ValueError):
                        data = {"detail":(await response.text())[:500]}
                    if response.status in (401,403):
                        raise ZurosAuthenticationError("Credencial recusada pela Zuros Auth.")
                    if response.status == 404:
                        raise ZurosResponseError("Recurso não encontrado na Zuros Auth.")
                    if response.status == 429 or response.status >= 500:
                        if attempt < retries:
                            await asyncio.sleep(.5 * 2**attempt); continue
                        raise ZurosUnavailableError(f"Zuros Auth indisponível (HTTP {response.status}).")
                    if response.status >= 400:
                        detail = data.get("detail") if isinstance(data,dict) else None
                        raise ZurosResponseError(
                            f"Operação recusada pela Zuros Auth (HTTP {response.status}): {detail or 'erro'}")
                    return data
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                if attempt < retries:
                    await asyncio.sleep(.5 * 2**attempt); continue
                LOGGER.warning("Falha de transporte Zuros Auth: %s", type(exc).__name__)
                raise ZurosUnavailableError("Não foi possível conectar à Zuros Auth.") from exc
    async def resolve_auth(self, guild_id):
        if not self.settings.gateway_secret:
            raise ZurosConfigurationError("Variável ausente: BOT_GATEWAY_SHARED_SECRET")
        return await self._request("GET","/internal/resolve",
            headers={"X-Gateway-Secret":self.settings.gateway_secret},
            params={"guild_id":str(guild_id)})
    async def status(self): return await self._request("GET","/internal/integration/status")
    async def get_verification_message(self):
        return await self._request("GET","/internal/verification-message")
    async def create_auth_link(self,user_id,guild_id):
        data=await self._request("POST","/internal/auth-link",json={
            "discord_user_id":str(user_id),"guild_id":str(guild_id)})
        url=data.get("url") if isinstance(data,dict) else None
        if not isinstance(url,str) or not url.startswith(("https://","http://")):
            raise ZurosResponseError("A API retornou um link de verificação inválido.")
        return AuthLink(url)
    async def check_verification(self,user_id):
        data=await self._request("POST","/internal/verification/check",
                                 json={"discord_user_id":str(user_id)})
        if not isinstance(data,dict) or "verified" not in data:
            raise ZurosResponseError("Resposta de verificação inválida.")
        return VerificationResult(bool(data["verified"]),data)
    async def rejoin(self,user_id,guild_id):
        return await self._request("POST","/internal/verification/rejoin",json={
            "discord_user_id":str(user_id),"guild_id":str(guild_id)})
    async def revoke(self,user_id,reason="manual"):
        return await self._request("POST","/internal/verification/revoke",json={
            "discord_user_id":str(user_id),"reason":reason})
    async def pending_role_sync(self):
        data=await self._request("GET","/internal/role-sync/pending")
        raw=data if isinstance(data,list) else data.get("items",[]) if isinstance(data,dict) else []
        return [RoleSyncItem(str(x["id"]),int(x["guild_id"]),int(x["discord_user_id"]),
                             int(x["verified_role_id"]),str(x["action"])) for x in raw]
    async def ack_role_sync(self,item_id,success=True):
        return await self._request("POST",f"/internal/role-sync/{item_id}/ack",
                                   params={"success":str(success).lower()})
