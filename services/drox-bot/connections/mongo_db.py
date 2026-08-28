import pymongo
import json
import os

# Try to get bot_id from config.json first
with open("config.json", "r", encoding="utf-8") as f:
    config = json.load(f)

bot_id = config.get("botID")

# If bot_id is empty or None, try to get from config_plan.json
if not bot_id:
    try:
        with open("configs/config_plan.json", "r", encoding="utf-8") as f:
            plan_config = json.load(f)
            # Extract bot_id from the plan config structure
            # The config_plan.json might have the bot_id in a different structure
            # We need to find it or use a fallback
            print(f"[MONGO_DB] botID not found in config.json, checking config_plan.json...")
            
            # Try to get bot_id from various possible locations
            bot_id = plan_config.get("bot_id") or plan_config.get("botID") or "default_bot"
            
            print(f"[MONGO_DB] Using bot_id: {bot_id}")
    except Exception as e:
        print(f"[MONGO_DB] Error reading config_plan.json: {e}")
        # Use a fallback bot_id to prevent empty collection name
        bot_id = f"bot_{os.environ.get('DISCLOUD_APP_ID', 'unknown')}"

# Carregar variáveis de ambiente do arquivo .env se ainda não carregadas
if not os.getenv("MONGO_URL") and os.path.exists(".env"):
    try:
        with open(".env", "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#"):
                    _parts = _line.split("=", 1)
                    if len(_parts) == 2:
                        os.environ[_parts[0].strip()] = _parts[1].strip()
    except Exception:
        pass

# Tenta obter do ambiente primeiro (recomendado)
mongo_url = os.getenv("MONGO_URL")
database_name = os.getenv("MONGO_DATABASE")

# Se não estiver no ambiente, tenta ler do configs/config_mongo.json
if not mongo_url or not database_name:
    try:
        with open("configs/config_mongo.json", "r", encoding="utf-8") as f:
            mongo_config = json.load(f)
        if not mongo_url:
            mongo_url = mongo_config.get("mongoURL")
        if not database_name:
            database_name = mongo_config.get("databaseName", "zuros_bots")
    except Exception as e:
        print(f"[MONGO_DB] Erro ao ler configs/config_mongo.json: {e}")

# Fallbacks se continuar vazio
if not mongo_url:
    mongo_url = "mongodb://localhost:27017"
if not database_name:
    database_name = "zuros_bots"

# Ensure bot_id is not empty
if not bot_id:
    bot_id = f"bot_{os.environ.get('DISCLOUD_APP_ID', 'fallback')}"

print(f"[MONGO_DB] Using bot_id as collection name: {bot_id}")

client = pymongo.MongoClient(mongo_url)
database = client[database_name]
collection = database[bot_id]