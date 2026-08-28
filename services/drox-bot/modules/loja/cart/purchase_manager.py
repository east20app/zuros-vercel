"""
Sistema de gerenciamento de histórico de compras
Armazena dados detalhados de cada compra para métricas e estatísticas
"""
import disnake
from functions.database import database as db
from typing import Dict, List, Optional
import random
import string


class PurchaseManager:
    """Gerencia o histórico de compras dos clientes"""
    
    @staticmethod
    def _generate_purchase_id(length: int = 12) -> str:
        """Gera um ID único para a compra"""
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
    
    @staticmethod
    def _load_purchases() -> dict:
        """Carrega e normaliza o documento de compras persistido."""
        data = db.get_document("loja_buys")
        if not isinstance(data, dict):
            data = {}

        purchases = data.get("purchases")
        data["purchases"] = purchases if isinstance(purchases, dict) else {}
        return data

    @staticmethod
    def _iter_purchases(data: dict):
        """Itera somente sobre registros válidos do documento persistido."""
        purchases_by_user = data.get("purchases", {})
        if not isinstance(purchases_by_user, dict):
            return
        for purchases in purchases_by_user.values():
            if not isinstance(purchases, list):
                continue
            for purchase in purchases:
                if isinstance(purchase, dict):
                    yield purchase

    @staticmethod
    def _limit_items(items: List[Dict], limit: Optional[int]) -> List[Dict]:
        """Aplica limite sem lançar exceção para valores vindos de configuração."""
        if limit is None:
            return items
        try:
            normalized_limit = int(limit)
        except (TypeError, ValueError):
            return items
        return items[:max(0, normalized_limit)]
    
    @staticmethod
    def _save_purchases(data: dict):
        """Salva o arquivo de compras"""
        db.save_document("loja_buys", data)
    
    @staticmethod
    def register_purchase(
        user_id: int,
        product_id: str,
        product_name: str,
        field_id: str,
        field_name: str,
        quantity: int,
        unit_price: float,
        total_price: float,
        discount_amount: float,
        final_price: float,
        payment_method: str,
        coupon_code: Optional[str] = None,
        items_received: Optional[List[str]] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Registra uma nova compra no histórico
        
        Args:
            user_id: ID do usuário que comprou
            product_id: ID do produto
            product_name: Nome do produto
            field_id: ID do campo/variação
            field_name: Nome do campo/variação
            quantity: Quantidade comprada
            unit_price: Preço unitário
            total_price: Preço total sem desconto
            discount_amount: Valor do desconto aplicado
            final_price: Preço final pago
            payment_method: Método de pagamento usado
            coupon_code: Código do cupom usado (se houver)
            items_received: Lista de itens entregues
            metadata: Dados adicionais (opcional)
        
        Returns:
            str: ID da compra registrada
        """
        data = PurchaseManager._load_purchases()
        
        # Gerar ID único para a compra
        purchase_id = PurchaseManager._generate_purchase_id()
        
        # Garantir que o ID é único
        existing_ids = {
            purchase.get("purchase_id")
            for purchase in PurchaseManager._iter_purchases(data)
            if purchase.get("purchase_id")
        }
        while purchase_id in existing_ids:
            purchase_id = PurchaseManager._generate_purchase_id()
        
        # Timestamp atual
        timestamp = int(disnake.utils.utcnow().timestamp())
        
        # Criar registro da compra
        purchase_record = {
            "purchase_id": purchase_id,
            "timestamp": timestamp,
            "product": {
                "id": product_id,
                "name": product_name
            },
            "field": {
                "id": field_id,
                "name": field_name
            },
            "quantity": quantity,
            "pricing": {
                "unit_price": unit_price,
                "total_price": total_price,
                "discount_amount": discount_amount,
                "final_price": final_price
            },
            "payment": {
                "method": payment_method,
                "coupon_code": coupon_code
            },
            "delivery": {
                "items": items_received or [],
                "items_count": len(items_received) if items_received else 0
            },
            "metadata": metadata or {}
        }
        
        # Adicionar ao histórico do usuário
        user_id_str = str(user_id)
        if user_id_str not in data["purchases"]:
            data["purchases"][user_id_str] = []
        
        data["purchases"][user_id_str].append(purchase_record)
        
        # Salvar
        PurchaseManager._save_purchases(data)
        
        return purchase_id
    
    @staticmethod
    def register_generic_payment(
        user_id: int,
        amount: float,
        payment_method: str,
        description: Optional[str] = None,
        payment_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Registra um pagamento genérico (sem produto específico) no histórico
        
        Args:
            user_id: ID do usuário que pagou
            amount: Valor pago
            payment_method: Método de pagamento usado
            description: Descrição do pagamento
            payment_id: ID do pagamento (opcional)
            metadata: Dados adicionais (opcional)
        
        Returns:
            str: ID da compra registrada
        """
        return PurchaseManager.register_purchase(
            user_id=user_id,
            product_id="generic_payment",
            product_name=description or "Pagamento Genérico",
            field_id="none",
            field_name="Pagamento",
            quantity=1,
            unit_price=amount,
            total_price=amount,
            discount_amount=0.0,
            final_price=amount,
            payment_method=payment_method,
            coupon_code=None,
            items_received=[],
            metadata={
                **(metadata or {}),
                "is_generic_payment": True,
                "payment_id": payment_id
            }
        )
    
    @staticmethod
    def get_user_purchases(user_id: int, limit: Optional[int] = None) -> List[Dict]:
        """
        Obtém o histórico de compras de um usuário
        
        Args:
            user_id: ID do usuário
            limit: Limite de compras a retornar (mais recentes primeiro)
        
        Returns:
            List[Dict]: Lista de compras do usuário
        """
        data = PurchaseManager._load_purchases()
        user_id_str = str(user_id)
        
        purchases = data["purchases"].get(user_id_str, [])
        if not isinstance(purchases, list):
            return []

        # Ordenar por timestamp (mais recente primeiro), tolerando registros antigos.
        purchases_sorted = sorted(
            (purchase for purchase in purchases if isinstance(purchase, dict)),
            key=lambda purchase: purchase.get("timestamp", 0),
            reverse=True,
        )
        return PurchaseManager._limit_items(purchases_sorted, limit)
    
    @staticmethod
    def get_purchase_by_id(purchase_id: str) -> Optional[Dict]:
        """
        Busca uma compra específica pelo ID
        
        Args:
            purchase_id: ID da compra
        
        Returns:
            Optional[Dict]: Dados da compra ou None se não encontrada
        """
        data = PurchaseManager._load_purchases()
        
        for purchase in PurchaseManager._iter_purchases(data):
            if purchase.get("purchase_id") == purchase_id:
                return purchase
        
        return None
    
    @staticmethod
    def get_all_purchases(limit: Optional[int] = None) -> List[Dict]:
        """
        Obtém todas as compras do sistema
        
        Args:
            limit: Limite de compras a retornar (mais recentes primeiro)
        
        Returns:
            List[Dict]: Lista de todas as compras
        """
        data = PurchaseManager._load_purchases()
        
        all_purchases = []
        for user_id, purchases in data["purchases"].items():
            if not isinstance(purchases, list):
                continue
            for purchase in purchases:
                if not isinstance(purchase, dict):
                    continue
                purchase_copy = purchase.copy()
                purchase_copy["user_id"] = user_id
                all_purchases.append(purchase_copy)

        all_purchases_sorted = sorted(
            all_purchases,
            key=lambda purchase: purchase.get("timestamp", 0),
            reverse=True,
        )
        return PurchaseManager._limit_items(all_purchases_sorted, limit)
    
    @staticmethod
    def get_product_purchases(product_id: str, limit: Optional[int] = None) -> List[Dict]:
        """
        Obtém todas as compras de um produto específico
        
        Args:
            product_id: ID do produto
            limit: Limite de compras a retornar
        
        Returns:
            List[Dict]: Lista de compras do produto
        """
        data = PurchaseManager._load_purchases()
        
        product_purchases = []
        for user_id, purchases in data["purchases"].items():
            if not isinstance(purchases, list):
                continue
            for purchase in purchases:
                if not isinstance(purchase, dict):
                    continue
                product = purchase.get("product", {})
                if isinstance(product, dict) and product.get("id") == product_id:
                    purchase_copy = purchase.copy()
                    purchase_copy["user_id"] = user_id
                    product_purchases.append(purchase_copy)

        product_purchases_sorted = sorted(
            product_purchases,
            key=lambda purchase: purchase.get("timestamp", 0),
            reverse=True,
        )
        return PurchaseManager._limit_items(product_purchases_sorted, limit)
    
    @staticmethod
    def get_statistics() -> Dict:
        """
        Calcula estatísticas gerais de vendas
        
        Returns:
            Dict: Estatísticas de vendas
        """
        data = PurchaseManager._load_purchases()
        
        total_purchases = 0
        total_revenue = 0.0
        total_items_sold = 0
        payment_methods = {}
        products_sold = {}
        
        for purchase in PurchaseManager._iter_purchases(data):
            total_purchases += 1
            pricing = purchase.get("pricing", {})
            pricing = pricing if isinstance(pricing, dict) else {}
            try:
                final_price = float(pricing.get("final_price", 0.0) or 0.0)
            except (TypeError, ValueError):
                final_price = 0.0
            total_revenue += final_price

            try:
                total_items_sold += int(purchase.get("quantity", 0) or 0)
            except (TypeError, ValueError):
                pass

            payment = purchase.get("payment", {})
            payment = payment if isinstance(payment, dict) else {}
            method = str(payment.get("method", "unknown") or "unknown")
            payment_methods[method] = payment_methods.get(method, 0) + 1

            product = purchase.get("product", {})
            product = product if isinstance(product, dict) else {}
            product_id = product.get("id", "unknown")
            product_name = product.get("name", "Unknown")
            if product_id not in products_sold:
                products_sold[product_id] = {
                    "name": product_name,
                    "count": 0,
                    "revenue": 0.0,
                }
            products_sold[product_id]["count"] += 1
            products_sold[product_id]["revenue"] += final_price
        
        return {
            "total_purchases": total_purchases,
            "total_revenue": total_revenue,
            "total_items_sold": total_items_sold,
            "unique_customers": len(data["purchases"]),
            "average_ticket": total_revenue / total_purchases if total_purchases > 0 else 0.0,
            "payment_methods": payment_methods,
            "products_sold": products_sold
        }
    
    @staticmethod
    def get_user_statistics(user_id: int) -> Dict:
        """
        Calcula estatísticas de compras de um usuário específico
        
        Args:
            user_id: ID do usuário
        
        Returns:
            Dict: Estatísticas do usuário
        """
        purchases = PurchaseManager.get_user_purchases(user_id)
        
        total_spent = 0.0
        total_items = 0
        products_bought = {}
        
        for purchase in purchases:
            pricing = purchase.get("pricing", {})
            pricing = pricing if isinstance(pricing, dict) else {}
            try:
                total_spent += float(pricing.get("final_price", 0.0) or 0.0)
            except (TypeError, ValueError):
                pass
            try:
                total_items += int(purchase.get("quantity", 0) or 0)
            except (TypeError, ValueError):
                pass

            product = purchase.get("product", {})
            product = product if isinstance(product, dict) else {}
            product_id = product.get("id", "unknown")
            if product_id not in products_bought:
                products_bought[product_id] = {
                    "name": product.get("name", "Unknown"),
                    "count": 0,
                    "spent": 0.0,
                }
            products_bought[product_id]["count"] += 1
            try:
                products_bought[product_id]["spent"] += float(pricing.get("final_price", 0.0) or 0.0)
            except (TypeError, ValueError):
                pass
        
        return {
            "total_purchases": len(purchases),
            "total_spent": total_spent,
            "total_items": total_items,
            "products_bought": products_bought,
            "first_purchase": purchases[-1].get("timestamp") if purchases else None,
            "last_purchase": purchases[0].get("timestamp") if purchases else None
        }
