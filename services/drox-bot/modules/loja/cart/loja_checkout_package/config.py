"""
Configurações centralizadas do sistema de carrinho
"""
from typing import Any, Dict, Optional

# Timeouts
CART_TIMEOUT_MINUTES = 15  # Tempo para expirar carrinho pendente
CART_CLEANUP_DAYS = 3  # Dias para limpar carrinhos aprovados

# Limites
MAX_QUANTITY_PER_PURCHASE = 1000000  # Quantidade máxima por compra
MIN_QUANTITY_PER_PURCHASE = 1  # Quantidade mínima por compra

# Mensagens padrão
MESSAGES = {
    "cart_created": "🛒 **Carrinho Criado**\nSeu carrinho foi criado com sucesso!",
    "cart_expired": "⏰ **Carrinho Expirado**\nSeu carrinho foi fechado automaticamente após {minutes} minutos sem pagamento.",
    "cart_cancelled": "❌ **Compra Cancelada**\nSua compra foi cancelada com sucesso.",
    "cart_approved": "✅ **Pagamento Aprovado**\nSeu pagamento foi aprovado com sucesso!",
    "dm_closed": "⚠️ **DM Fechada**\nNão foi possível enviar os itens por DM. Os itens serão entregues aqui no carrinho.",
    "maintenance": "🔧 **Sistema em Manutenção**\n{message}",
    "no_stock": "📦 **Sem Estoque**\nDesculpe, não há estoque suficiente para este produto.",
    "invalid_quantity": "❌ **Quantidade Inválida**\nPor favor, insira uma quantidade entre {min} e {max}.",
    "invalid_coupon": "❌ **Cupom Inválido**\nO cupom informado não existe ou expirou.",
    "payment_pending": "⏳ **Aguardando Pagamento**\nSeu pagamento está sendo processado...",
    "delivery_success": "📦 **Entrega Realizada**\nSeus itens foram entregues com sucesso!",
    "copy_product": "📋 **Produto Copiado**\nOs dados do produto foram copiados para a área de transferência."
}

# Status de carrinho
CART_STATUS = {
    "PENDING": "pending",
    "APPROVED": "approved",
    "CANCELLED": "cancelled",
    "EXPIRED": "expired",
    "DELIVERED": "delivered"
}

# Cores padrão
COLORS = {
    "success": 0x43B581,  # Verde
    "warning": 0xFAA61A,  # Amarelo
    "error": 0xF04747,    # Vermelho
    "info": 0x7289DA,     # Azul
    "default": 0x2F3136   # Cinza escuro
}

def get_maintenance_config() -> Dict[str, Any]:
    """Retorna uma configuração de manutenção segura e compatível.

    Documentos antigos ou parcialmente preenchidos continuam sendo aceitos;
    valores inválidos voltam para os padrões do módulo em vez de provocarem
    erros em tempo de execução.
    """
    from functions.database import database as db

    raw_config = db.get_document("loja_maintenance") or {}
    config = raw_config if isinstance(raw_config, dict) else {}
    message = config.get("message", MESSAGES["maintenance"])

    return {
        "enabled": bool(config.get("enabled", False)),
        "message": message if isinstance(message, str) and message.strip() else MESSAGES["maintenance"],
        "allow_admins": bool(config.get("allow_admins", True)),
    }


def is_maintenance_active(user_id: Optional[int] = None) -> tuple[bool, str]:
    """Verifica se o sistema está em manutenção.

    O parâmetro ``user_id`` permanece na assinatura por compatibilidade com os
    chamadores atuais. A regra de bypass de administradores continua sendo
    responsabilidade da camada que possui o objeto ``Member`` do Discord.
    """
    config = get_maintenance_config()

    if not config["enabled"]:
        return False, ""

    return True, config["message"]
