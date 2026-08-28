import asyncio
"""Compatibilidade central da configuração Zuros Auth."""
import os
from dataclasses import asdict
from functions.database import database as db
from .zuros_client import DEFAULT_BACKEND_URL,ZurosClient,ZurosError as ZurosCloudError,ZurosSettings
_client=None
def get_zuros_credentials():
    saved=(db.get_document("cloud_data") or {}).get("zuros_auth") or {}
    return {"base_url":(os.getenv("ZUROS_BACKEND_URL") or saved.get("base_url") or DEFAULT_BACKEND_URL).rstrip("/"),
        "auth_id":(os.getenv("ZUROS_AUTH_ID") or saved.get("auth_id") or "").strip(),
        "bot_credential":(os.getenv("ZUROS_BOT_CREDENTIAL") or saved.get("bot_credential") or "").strip()}
def _settings():
    c=get_zuros_credentials()
    return ZurosSettings(c["base_url"],c["auth_id"],c["bot_credential"],
                         (os.getenv("BOT_GATEWAY_SHARED_SECRET") or "").strip())
def is_zuros_configured(): return _settings().configured
def save_zuros_credentials(auth_id,bot_credential,base_url=DEFAULT_BACKEND_URL):
    global _client
    previous_client=_client
    config=db.get_document("cloud_data") or {}
    config["zuros_auth"]={"base_url":str(base_url).rstrip("/"),"auth_id":str(auth_id).strip(),
                          "bot_credential":str(bot_credential).strip()}
    db.save_document("cloud_data",config)
    _client=None
    if previous_client is not None:
        try: asyncio.get_running_loop().create_task(previous_client.close())
        except RuntimeError: pass
def get_zuros_cloud():
    global _client
    settings=_settings(); settings.validate()
    if _client is None or _client.settings != settings: _client=ZurosClient(settings)
    return _client
class ZurosCloud(ZurosClient):
    def __init__(self,base_url,auth_id,bot_credential,**kwargs):
        super().__init__(ZurosSettings(base_url.rstrip("/"),auth_id,bot_credential),**kwargs)
    async def auth_link(self,user_id,guild_id): return (await self.create_auth_link(user_id,guild_id)).url
    async def is_verified(self,user_id): return (await self.check_verification(user_id)).verified
    async def verification_message(self): return await self.get_verification_message()
    async def pending_roles(self): return [asdict(x) for x in await self.pending_role_sync()]
    async def ack_role(self,item_id,success=True): return await self.ack_role_sync(item_id,success)
    async def auth_count(self):
        data=await self.status(); return int(data.get("verified_count",0))
