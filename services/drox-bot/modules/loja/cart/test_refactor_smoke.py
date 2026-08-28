"""Smoke tests locais para os módulos refatorados.

O teste usa dependências mínimas simuladas e não inicia o bot nem acessa a rede.
"""
import importlib.util
import sys
import types
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class FakeDatabase:
    def __init__(self):
        self.documents = {}

    def get_document(self, key):
        return self.documents.get(key)

    def save_document(self, key, value):
        self.documents[key] = value

    def obter(self, key):
        return self.documents.get(key)


db = FakeDatabase()

# Dependências mínimas usadas pelos módulos sob teste.
functions = types.ModuleType("functions")
database_module = types.ModuleType("functions.database")
database_module.database = db
emoji_module = types.ModuleType("functions.emoji")
emoji_module.emoji = types.SimpleNamespace()
functions.database = database_module
functions.emoji = emoji_module
sys.modules["functions"] = functions
sys.modules["functions.database"] = database_module
sys.modules["functions.emoji"] = emoji_module


disnake = types.ModuleType("disnake")
disnake.Guild = object
disnake.utils = types.SimpleNamespace(
    utcnow=lambda: datetime.now(timezone.utc),
)
sys.modules["disnake"] = disnake


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


config = load_module("config")
coupons = load_module("coupon_validator")
purchases = load_module("purchase_manager")
stock = load_module("stock_manager")


# Configuração inválida deve retornar defaults utilizáveis.
db.documents["loja_maintenance"] = {"enabled": "yes", "message": None}
maintenance = config.get_maintenance_config()
assert maintenance["enabled"] is True
assert maintenance["message"] == config.MESSAGES["maintenance"]

# Cupom de produto: normalização, limites e desconto máximo.
db.documents["loja_products"] = {
    "p1": {"cupons": {"c1": {"name": " desconto ", "percent": 25, "active": True}}}
}
valid, error, discount, coupon = coupons.CouponValidator.validate_product_coupon(
    " DESCONTO ", "p1", 10, 100
)
assert valid and not error and discount == 25 and coupon["name"].strip() == "desconto"

# Estoque: quantidade inválida não altera dados; quantidade válida retira itens.
db.documents["loja_products"] = {"p1": {"campos": {"f1": {}}}}
db.documents["loja_estoque"] = {"p1": {"f1": ["A", "B"]}}
assert stock.StockManager.get_stock_items("p1", "f1", 0) is None
assert stock.StockManager.get_stock_items("p1", "f1", 1) == ["A"]
assert db.documents["loja_estoque"]["p1"]["f1"] == ["B"]

# Reposição normaliza estrutura inválida sem quebrar.
db.documents["loja_estoque"] = {"p1": "estrutura-antiga"}
assert stock.StockManager.add_stock_items("p1", "f1", ["C"]) is True
assert db.documents["loja_estoque"]["p1"]["f1"] == ["C"]

# Histórico ignora linhas inválidas e calcula estatísticas dos registros válidos.
db.documents["loja_buys"] = {
    "purchases": {"10": [{"purchase_id": "old", "timestamp": 1}, "inválido"]}
}
purchase_id = purchases.PurchaseManager.register_purchase(
    user_id=10,
    product_id="p1",
    product_name="Produto",
    field_id="f1",
    field_name="Campo",
    quantity=1,
    unit_price=10,
    total_price=10,
    discount_amount=0,
    final_price=10,
    payment_method="pix",
)
assert purchase_id
assert purchases.PurchaseManager.get_purchase_by_id(purchase_id)["product"]["id"] == "p1"
assert purchases.PurchaseManager.get_statistics()["total_purchases"] == 2

print("OK: smoke tests de refatoração passaram")
