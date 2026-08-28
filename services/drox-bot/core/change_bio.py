import os
from functions.emoji import emoji
from functions.database import database as db
import requests


def change_bio():
    database = db.obter("config.json")

    token = (os.getenv("DISCORD_BOT_TOKEN") or database.get("bot", {}).get("token") or database.get("botToken") or "").strip()
    bot_id = database["bot"]["id"]

    description = (
        f"{getattr(emoji, 'star', '⭐')} **Tecnologia Zuros Bot**\n"
        "O melhor sistema de vendas e automação para Discord.\n"
        "https://app.zuros.site/"
    )

    url = f"https://discord.com/api/v10/applications/{bot_id}"

    headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
    }

    payload = {
        "description": description
    }

    try:
        response = requests.patch(
            url,
            headers=headers,
            json=payload,
            timeout=15
        )

        response.raise_for_status()
        print("[BIO] Bio atualizada com sucesso!")

        return True

    except requests.RequestException as error:
        print(f"[BIO] Erro ao atualizar bio: {error}")
        return False