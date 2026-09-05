from functions.database import database as db

def carregar_config() -> dict:
    """Carrega a configuração dos formulários."""
    return db.get_document("automations_forms") or {"ativado": False, "forms": {}}

def salvar_config(data: dict) -> None:
    """Salva a configuração dos formulários."""
    db.save_document("automations_forms", data)