import os
from pathlib import Path
CONFIG_FILE = Path(__file__).resolve().parent.parent / "config.json"
TOKEN_FILE = Path(__file__).resolve().parent.parent / "token.txt"
from functions.database import database as db
from disnake.ext import commands
import disnake
import requests

def obter_info():
        data = db.obter(str(CONFIG_FILE))
        headers = {"authorization": data['botToken'], "content-type": "application/json"}
        url = f"{data['apiURL']}/api/bot/{data['botID']}/info"

        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
        
            print(f"[ObterInfo] Erro na requisição. Status: {response.status_code}")
            exit(1)
        except requests.exceptions.RequestException as e:
            print(f"[ObterInfo] Falha ao conectar na API: {e}")
            print("[ObterInfo] Usando configuração local...")
            return data["bot"]

def salvar_info(info: dict):
    config_db = db.obter(str(CONFIG_FILE))
    existing_bot = config_db.get("bot", {}) or {}
    config_db["bot"] = {k: info[k] for k in ("owner", "id", "perms", "server") if k in info}
    saved_token = existing_bot.get("token") or config_db.get("botToken")
    if saved_token:
        config_db["bot"]["token"] = saved_token
    if "version" in info:
        config_db["version"] = info["version"]
    db.salvar(str(CONFIG_FILE), config_db)

def create_bot() -> tuple[commands.Bot, str, str]:
    config_db = db.obter(str(CONFIG_FILE))
    if config_db["saveConfig"] == True:
        info = obter_info()
        salvar_info(info)
    else:
        info = config_db["bot"]

    intents = disnake.Intents.default()
    intents.message_content = True
    intents.members = True
    intents.guilds = True

    bot = commands.Bot(
        command_prefix=commands.when_mentioned,
        intents=intents,
        help_command=None,
        reload=True
    )
    file_token = TOKEN_FILE.read_text(encoding="utf-8").strip() if TOKEN_FILE.exists() else ""
    token = (file_token or os.getenv("DISCORD_BOT_TOKEN") or info.get("token") or (config_db.get("bot", {}) or {}).get("token") or config_db.get("botToken") or "").strip()
    if not token:
        raise RuntimeError("Token do Discord não configurado no painel nem em DISCORD_BOT_TOKEN")
    return bot, token, info["id"]