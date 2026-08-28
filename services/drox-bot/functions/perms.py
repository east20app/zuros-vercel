import os

from functions.database import database as db


def _normalized_ids(value) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, str):
        return {item.strip() for item in value.replace(";", ",").split(",") if item.strip()}
    if isinstance(value, (list, tuple, set)):
        return {str(item).strip() for item in value if str(item).strip()}
    return {str(value).strip()} if str(value).strip() else set()


def _bot_config() -> dict:
    try:
        config = db.obter("config.json") or {}
        value = config.get("bot", {}) if isinstance(config, dict) else {}
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _owner_id(bot_config: dict | None = None) -> str | None:
    # A hospedagem injeta o dono atual. Ele prevalece sobre config.json
    # protegido que pode ter ficado com o proprietário anterior.
    environment_owner = os.getenv("OWNER_ID", "").strip()
    if environment_owner:
        return environment_owner
    value = (bot_config or _bot_config()).get("owner")
    return str(value).strip() if value is not None and str(value).strip() else None


class perms:
    @staticmethod
    async def check(user_id) -> bool:
        """Aceita o dono atual e administradores explicitamente delegados."""
        try:
            bot_config = _bot_config()
            normalized_user = str(user_id).strip()
            if normalized_user == _owner_id(bot_config):
                return True
            configured = _normalized_ids(bot_config.get("perms"))
            configured.update(_normalized_ids(os.getenv("PERMS")))
            return normalized_user in configured
        except Exception:
            return False

    @staticmethod
    async def check_owner(user_id) -> bool:
        """Aceita somente o dono da aplicação hospedada atual."""
        try:
            owner = _owner_id()
            return owner is not None and str(user_id).strip() == owner
        except Exception:
            return False