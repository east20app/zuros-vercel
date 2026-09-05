import asyncio
import hashlib
import json
import os
import sys
import threading
from datetime import datetime, timezone

import aiohttp
from bson import json_util
from disnake.ext import commands
from pymongo.errors import PyMongoError

from connections.mongo_db import collection as bot_collection
from functions.database import database


POLL_INTERVAL_SECONDS = 4
PROTECTED_DOCUMENTS = {
    "pagamentos",
    "payment_configs",
    "nubank_pending_payments",
    "payment_tracking",
    "bot_connection",
}

# O fallback consulta somente configurações suportadas pelo painel e os IDs
# protegidos (estes últimos apenas para gerar alerta).
EXTERNALLY_CONFIGURABLE_DOCUMENTS = {
    "automations_ai_chat", "automations_ai_moderator", "automations_boas_vindas",
    "automations_clean", "automations_cont_members", "automations_cont_members_call",
    "automations_feedbacks", "automations_invite_tracker", "automations_lock_unlock",
    "automations_msg_auto", "automations_nuke", "automations_repost",
    "automations_reactions", "automations_response_auto", "automations_suggestions",
    "automations_topics", "canais", "cargos", "convites", "custom_colors",
    "custom_mode", "custom_status", "interaction_monitor_config", "loja_config", "loja_data",
    "loja_doubt_button", "loja_maintenance", "loja_personalization",
    "loja_preferences", "loja_qr_customization", "loja_saldo_config",
    "loja_stock_notifications", "products_preferences", "tickets_config",
    "antifake_config", "antifake_authorized", "protection_config",
    "automations", "automations_cont_vendas", "blacklist",
    "cloud_data", "cloud_tasks", "cloud_gifts", "custom_info",
    "enviar_dm_editor", "giveaways", "automations_disparador_dm", "automations_forms", "loja_mass_coupons", "loja_products",
    "extensions_config", "extensions_droxgen", "extensions_boost_data", "extensions_boost_stock",
    "extensions_subscriptions", "extensions_pending_payments", "extensions_payment_history",
    "loja_roles_temp", "loja_stock_requests", "messages_anunciar",
    "messages_templates1", "notifications_config", "products",
    "protection_privatizacoes_apps", "protection_privatizacoes_cargos",
    "protection_privatizacoes_mencoes", "protection_privatizacoes_perms",
    "protection_privatizacoes_persistencia", "protection_privatizacoes_urls",
    "protection_protecaogeral_banimentos", "protection_protecaogeral_canais",
    "protection_protecaogeral_cargos", "protection_protecaogeral_comandosext",
    "protection_protecaogeral_expulsoes", "protection_protecaogeral_webhooks",
}


def _fingerprint(document):
    if document is None:
        return None
    payload = json.dumps(document, default=json_util.default, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class DatabaseWatcher(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._stop = threading.Event()
        self._worker = None
        self._alert_queue = None
        self._alert_task = None

    @commands.Cog.listener("on_ready")
    async def on_ready(self):
        if self._worker and not self._worker.done():
            return
        self._stop.clear()
        self._alert_queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        self._worker = loop.run_in_executor(None, self._run_watcher, loop)
        self._alert_task = asyncio.create_task(self._send_alerts())

    def cog_unload(self):
        self._stop.set()
        if self._alert_task:
            self._alert_task.cancel()

    def _run_watcher(self, loop):
        try:
            self._run_change_stream(loop)
        except PyMongoError as exc:
            print(f"[DATABASE WATCHER] Change Stream indisponível ({exc}); usando polling a cada 4s.")
            self._run_polling(loop)
        except Exception as exc:
            print(f"[DATABASE WATCHER] Falha no Change Stream ({exc}); usando polling a cada 4s.")
            self._run_polling(loop)

    def _run_change_stream(self, loop):
        pipeline = [{"$match": {"operationType": {"$in": ["insert", "update", "replace", "delete"]}}}]
        with bot_collection.watch(pipeline, full_document="updateLookup", max_await_time_ms=2000) as stream:
            print("[DATABASE WATCHER] Change Stream ativo.")
            while not self._stop.is_set():
                event = stream.try_next()
                if event:
                    self._handle_change(event.get("documentKey", {}).get("_id"), event.get("fullDocument"), loop)

    def _run_polling(self, loop):
        watched_ids = EXTERNALLY_CONFIGURABLE_DOCUMENTS | PROTECTED_DOCUMENTS
        query = {"_id": {"$in": list(watched_ids)}}
        previous = self._poll_snapshot(query)
        while not self._stop.wait(POLL_INTERVAL_SECONDS):
            current = self._poll_snapshot(query)
            for doc_id in watched_ids:
                if previous.get(doc_id) != current.get(doc_id):
                    document = bot_collection.find_one({"_id": doc_id})
                    self._handle_change(doc_id, document, loop)
            previous = current

    @staticmethod
    def _poll_snapshot(query):
        return {doc["_id"]: _fingerprint(doc) for doc in bot_collection.find(query)}

    def _handle_change(self, doc_id, document, loop):
        if not isinstance(doc_id, str):
            return
        updated_at = document.get("_updatedAt") if document else None
        local_write = database.is_recent_local_write(doc_id, updated_at)
        if doc_id in PROTECTED_DOCUMENTS and not local_write:
            message = f"Escrita externa inesperada detectada no documento protegido `{doc_id}`."
            asyncio.run_coroutine_threadsafe(self._alert_queue.put(message), loop)
        # Invalidar somente se estiver cacheado; clear_cache já faz pop seguro.
        with database._cache_lock:
            is_cached = doc_id in database._cache
        if is_cached:
            database.clear_cache(doc_id)
            print(f"[DATABASE WATCHER] Cache invalidado: {doc_id}")

    async def _send_alerts(self):
        # bot.py roda como __main__ em produção; assim usamos exatamente o
        # ERROR_WEBHOOK_URL já resolvido por ele, inclusive seu fallback atual.
        webhook_url = getattr(sys.modules.get("__main__"), "ERROR_WEBHOOK_URL", None)
        webhook_url = webhook_url or os.getenv("ERROR_WEBHOOK_URL")
        if not webhook_url:
            try:
                with open("config.json", "r", encoding="utf-8") as file:
                    webhook_url = json.load(file).get("env", {}).get("ERROR_WEBHOOK_URL")
            except Exception:
                webhook_url = None
        while True:
            message = await self._alert_queue.get()
            print(f"[DATABASE WATCHER] ALERTA: {message}")
            if not webhook_url:
                continue
            payload = {"embeds": [{
                "title": "Alerta de configuração externa",
                "description": message,
                "color": 0xE74C3C,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }]}
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(webhook_url, json=payload, timeout=10) as response:
                        if response.status not in (200, 204):
                            print(f"[DATABASE WATCHER] Webhook respondeu HTTP {response.status}.")
            except Exception as exc:
                print(f"[DATABASE WATCHER] Erro ao enviar alerta: {exc}")


def setup(bot):
    bot.add_cog(DatabaseWatcher(bot))

