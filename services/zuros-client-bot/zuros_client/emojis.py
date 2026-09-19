"""Catálogo e sincronização de emojis de aplicação do DROX Bot."""

import asyncio
import base64
import logging
from pathlib import Path

import aiohttp

log = logging.getLogger(__name__)

ASSETS_DIR = Path(__file__).with_name("assets") / "emojis"
DISCORD_API = "https://discord.com/api/v10"


class emoji:
    """Catálogo compatível com ``functions.emoji.emoji`` do DROX Bot."""

    zuros = "⚡"
    robot = "🤖"
    store = "🛍️"
    cart = "🛒"
    cardbox = "📦"
    calendar = "📅"
    time = "🕒"
    members = "👥"
    plus = "➕"
    minus = "➖"
    ticket = "🎫"
    receipt = "🧾"
    double_check = "✅"
    delete = "🗑️"
    unlock = "🔓"
    warn = "⚠️"
    reload = "♻️"
    sync = "🔄"
    website = "🌐"
    speech = "💬"
    correct = "✅"
    wrong = "❌"
    online = "🟢"
    on = "🟢"
    off = "🔴"
    loading = "⏳"
    thunder = "⚡"
    wifi = "📡"
    wallet = "💳"
    pix = "💠"
    play = "▶️"
    power = "⏹️"
    settings = "⚙️"
    lock = "🔒"
    edit = "✏️"
    link = "🔗"

    @classmethod
    async def sync_application(
        cls, application_id: int, token: str, *, upload_missing: bool = True
    ) -> None:
        """Carrega e cria, quando necessário, os emojis da aplicação Discord."""
        if not ASSETS_DIR.is_dir():
            log.warning("Diretório de emojis não encontrado: %s", ASSETS_DIR)
            return

        headers = {"Authorization": f"Bot {token}"}
        url = f"{DISCORD_API}/applications/{application_id}/emojis"
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
            try:
                async with session.get(url) as response:
                    response.raise_for_status()
                    payload = await response.json()
            except (aiohttp.ClientError, TimeoutError, ValueError) as error:
                log.warning("Não foi possível carregar os emojis da aplicação: %s", error)
                return

            existing = {item["name"]: item for item in payload.get("items", [])}
            cls._apply(existing)
            if not upload_missing:
                log.info("Emojis ZUROS existentes carregados: %s", len(existing))
                return
            created = 0
            for asset in sorted(ASSETS_DIR.iterdir()):
                if asset.suffix.lower() not in {".png", ".gif", ".jpg", ".jpeg"}:
                    continue
                if asset.stem in existing:
                    continue
                item = await cls._upload(session, url, asset)
                if item is not None:
                    existing[asset.stem] = item
                    cls._apply({asset.stem: item})
                    created += 1
                await asyncio.sleep(0.35)
            log.info(
                "Emojis ZUROS sincronizados: %s disponíveis, %s enviados",
                len(existing),
                created,
            )

    @classmethod
    async def _upload(
        cls, session: aiohttp.ClientSession, url: str, asset: Path
    ) -> dict[str, object] | None:
        mime = "image/gif" if asset.suffix.lower() == ".gif" else "image/png"
        asset_bytes = await asyncio.to_thread(asset.read_bytes)
        image = base64.b64encode(asset_bytes).decode("ascii")
        payload = {"name": asset.stem, "image": f"data:{mime};base64,{image}"}
        for _ in range(4):
            try:
                async with session.post(url, json=payload) as response:
                    if response.status == 201:
                        return await response.json()
                    if response.status == 429:
                        data = await response.json()
                        await asyncio.sleep(float(data.get("retry_after", 1)))
                        continue
                    detail = await response.text()
                    log.warning(
                        "Falha ao enviar emoji %s: HTTP %s %s",
                        asset.stem,
                        response.status,
                        detail[:160],
                    )
                    return None
            except (aiohttp.ClientError, TimeoutError, ValueError) as error:
                log.warning("Falha ao enviar emoji %s: %s", asset.stem, error)
                return None
        return None

    @classmethod
    def _apply(cls, items: dict[str, dict[str, object]]) -> None:
        for name, item in items.items():
            emoji_id = item.get("id")
            if not emoji_id:
                continue
            prefix = "a" if item.get("animated") else ""
            setattr(cls, name, f"<{prefix}:{name}:{emoji_id}>")
