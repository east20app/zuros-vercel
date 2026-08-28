import os
from functions.database import database as db
import requests

def toggle_intents():
    database = db.obter("config.json")
    token = (os.getenv("DISCORD_BOT_TOKEN") or database.get("bot", {}).get("token") or database.get("botToken") or "").strip()
    id = database["bot"]["id"]

    url = f"https://discord.com/api/v9/applications/{id}"
    headers = {
        "authorization": f"Bot {token}",
        "content-type": "application/json",
    }
    payload = {
        "bot_public": True,
        "bot_require_code_grant": False,
        "flags": 565248
    }

    requests.patch(url, headers=headers, json=payload)
    return