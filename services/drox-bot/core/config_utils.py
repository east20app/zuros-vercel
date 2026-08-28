import copy


def normalize_bot_config(config: dict) -> dict:
    """Garante que os campos de configuração do bot fiquem consistentes."""
    normalized = copy.deepcopy(config or {})

    bot_token = (normalized.get("botToken") or "").strip()
    bot_id = (normalized.get("botID") or "").strip()

    bot_config = normalized.setdefault("bot", {})
    if not isinstance(bot_config, dict):
        bot_config = {}
        normalized["bot"] = bot_config

    if bot_token:
        bot_config["token"] = bot_token
        normalized["botToken"] = bot_token

    if bot_id:
        bot_config["id"] = bot_id
        normalized["botID"] = bot_id

    return normalized


def resolve_bot_credentials(config: dict) -> dict:
    """Resolve o token e o ID do bot a partir do config.json."""
    normalized = normalize_bot_config(config)
    token = (normalized.get("botToken") or "").strip()
    bot_id = (normalized.get("botID") or "").strip()

    if not token:
        bot_section = normalized.get("bot", {}) or {}
        token = (bot_section.get("token") or "").strip()

    if not bot_id:
        bot_section = normalized.get("bot", {}) or {}
        bot_id = (bot_section.get("id") or "").strip()

    return {"token": token, "bot_id": bot_id}

