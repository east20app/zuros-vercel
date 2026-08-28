"""
Gerenciador centralizado de saldo
Fornece métodos para obter, adicionar, usar e reembolsar saldo dos usuários de forma segura.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, List
from functions.database import database as db

logger = logging.getLogger("drox.loja.saldo")


class BalanceManager:
    """Gerenciador de saldo de usuários"""
    
    # Locks para garantir atômicos em operações concorrentes
    _user_locks: Dict[str, asyncio.Lock] = {}
    _lock_lock = asyncio.Lock()

    @staticmethod
    async def _get_user_lock(user_id: int) -> asyncio.Lock:
        """Obtém ou cria um Lock assíncrono para um usuário específico"""
        user_key = str(user_id)
        async with BalanceManager._lock_lock:
            if user_key not in BalanceManager._user_locks:
                BalanceManager._user_locks[user_key] = asyncio.Lock()
            return BalanceManager._user_locks[user_key]
            
    @staticmethod
    def _get_config() -> dict:
        """Obtém configuração do sistema de saldo"""
        return db.get_document("loja_saldo_config") or {}
    
    @staticmethod
    def _get_users_doc() -> dict:
        """Obtém documento de usuários"""
        return db.get_document("loja_saldo_users") or {"users": {}}
    
    @staticmethod
    def _save_users_doc(doc: dict) -> None:
        """Salva documento de usuários"""
        db.save_document("loja_saldo_users", doc)
    
    @staticmethod
    def is_enabled() -> bool:
        """Verifica se o sistema de saldo está ativo"""
        config = BalanceManager._get_config()
        return config.get("enabled", False)
    
    @staticmethod
    def get_user_data(user_id: int) -> dict:
        """Obtém dados de saldo de um usuário (Síncrono para retrocompatibilidade)"""
        doc = BalanceManager._get_users_doc()
        users = doc.get("users", {})
        return users.get(str(user_id), {
            "balance": 0,
            "total_deposited": 0,
            "total_used": 0,
            "deposits": [],
            "transactions": []
        })
    
    @staticmethod
    def get_user_balance(user_id: int) -> float:
        """Obtém o saldo atual do usuário"""
        user_data = BalanceManager.get_user_data(user_id)
        return user_data.get("balance", 0)
    
    @staticmethod
    async def add_balance(
        user_id: int,
        amount: float,
        bonus: float = 0,
        deposit_id: Optional[str] = None,
        payment_method: str = "pix"
    ) -> dict:
        """
        Adiciona saldo ao usuário de forma atômica
        """
        lock = await BalanceManager._get_user_lock(user_id)
        async with lock:
            try:
                # Executa a leitura em thread para não travar o loop principal
                doc = await asyncio.to_thread(BalanceManager._get_users_doc)
                users = doc.get("users", {})
                
                user_data = users.get(str(user_id), {
                    "balance": 0,
                    "total_deposited": 0,
                    "total_used": 0,
                    "deposits": [],
                    "transactions": []
                })
                
                total_credit = amount + bonus
                
                # Atualizar saldo
                user_data["balance"] = user_data.get("balance", 0) + total_credit
                user_data["total_deposited"] = user_data.get("total_deposited", 0) + amount
                
                # Registrar depósito
                deposit_record = {
                    "id": deposit_id or str(int(datetime.utcnow().timestamp())),
                    "amount": amount,
                    "bonus": bonus,
                    "total_credit": total_credit,
                    "payment_method": payment_method,
                    "timestamp": int(datetime.utcnow().timestamp())
                }
                user_data.setdefault("deposits", []).append(deposit_record)
                
                # Registrar transação
                transaction = {
                    "type": "deposit",
                    "amount": total_credit,
                    "deposit_amount": amount,
                    "bonus": bonus,
                    "reference_id": deposit_id,
                    "description": f"Depósito via {payment_method.upper()}",
                    "timestamp": int(datetime.utcnow().timestamp())
                }
                user_data.setdefault("transactions", []).append(transaction)
                
                users[str(user_id)] = user_data
                doc["users"] = users
                
                # Salva em thread para evitar travamento de I/O
                await asyncio.to_thread(BalanceManager._save_users_doc, doc)
                
                logger.info(
                    f"[SALDO] Crédito adicionado: Usuário={user_id}, Valor={amount}, Bônus={bonus}, Método={payment_method}, NovoSaldo={user_data['balance']}"
                )
                return user_data
            except Exception as e:
                logger.error(f"[SALDO] Erro ao adicionar saldo para {user_id}: {e}", exc_info=True)
                raise e
    
    @staticmethod
    async def use_balance(
        user_id: int,
        amount: float,
        reference_id: Optional[str] = None,
        description: str = "Uso de saldo"
    ) -> tuple[bool, str]:
        """
        Usa saldo do usuário de forma atômica
        """
        lock = await BalanceManager._get_user_lock(user_id)
        async with lock:
            try:
                doc = await asyncio.to_thread(BalanceManager._get_users_doc)
                users = doc.get("users", {})
                
                user_data = users.get(str(user_id))
                if not user_data:
                    logger.warning(f"[SALDO] Tentativa de uso sem saldo: Usuário={user_id}")
                    return False, "Usuário não possui saldo"
                
                current_balance = user_data.get("balance", 0)
                if current_balance < amount:
                    logger.warning(
                        f"[SALDO] Saldo insuficiente: Usuário={user_id}, Necessário={amount}, Disponível={current_balance}"
                    )
                    return False, f"Saldo insuficiente. Disponível: R$ {current_balance:.2f}"
                
                # Deduzir saldo
                user_data["balance"] = current_balance - amount
                user_data["total_used"] = user_data.get("total_used", 0) + amount
                
                # Registrar transação
                transaction = {
                    "type": "usage",
                    "amount": -amount,
                    "reference_id": reference_id,
                    "description": description,
                    "timestamp": int(datetime.utcnow().timestamp())
                }
                user_data.setdefault("transactions", []).append(transaction)
                
                users[str(user_id)] = user_data
                doc["users"] = users
                
                await asyncio.to_thread(BalanceManager._save_users_doc, doc)
                
                logger.info(
                    f"[SALDO] Saldo usado: Usuário={user_id}, Valor={amount}, Ref={reference_id}, NovoSaldo={user_data['balance']}"
                )
                return True, f"R$ {amount:.2f} deduzido do saldo"
            except Exception as e:
                logger.error(f"[SALDO] Erro ao usar saldo para {user_id}: {e}", exc_info=True)
                return False, f"Erro interno ao processar uso de saldo: {e}"
    
    @staticmethod
    async def refund_balance(
        user_id: int,
        amount: float,
        reference_id: Optional[str] = None,
        description: str = "Reembolso"
    ) -> tuple[bool, str]:
        """
        Reembolsa saldo ao usuário de forma atômica
        """
        lock = await BalanceManager._get_user_lock(user_id)
        async with lock:
            try:
                doc = await asyncio.to_thread(BalanceManager._get_users_doc)
                users = doc.get("users", {})
                
                user_data = users.get(str(user_id), {
                    "balance": 0,
                    "total_deposited": 0,
                    "total_used": 0,
                    "deposits": [],
                    "transactions": []
                })
                
                # Adicionar saldo
                user_data["balance"] = user_data.get("balance", 0) + amount
                user_data["total_used"] = max(0, user_data.get("total_used", 0) - amount)
                
                # Registrar transação
                transaction = {
                    "type": "refund",
                    "amount": amount,
                    "reference_id": reference_id,
                    "description": description,
                    "timestamp": int(datetime.utcnow().timestamp())
                }
                user_data.setdefault("transactions", []).append(transaction)
                
                users[str(user_id)] = user_data
                doc["users"] = users
                
                await asyncio.to_thread(BalanceManager._save_users_doc, doc)
                
                logger.info(
                    f"[SALDO] Saldo reembolsado: Usuário={user_id}, Valor={amount}, Ref={reference_id}, NovoSaldo={user_data['balance']}"
                )
                return True, f"R$ {amount:.2f} reembolsado"
            except Exception as e:
                logger.error(f"[SALDO] Erro ao reembolsar saldo para {user_id}: {e}", exc_info=True)
                return False, f"Erro interno ao reembolsar saldo: {e}"
    
    @staticmethod
    def get_deposit_history(user_id: int, limit: int = 10) -> List[dict]:
        """Obtém histórico de depósitos do usuário"""
        user_data = BalanceManager.get_user_data(user_id)
        deposits = user_data.get("deposits", [])
        return sorted(deposits, key=lambda x: x.get("timestamp", 0), reverse=True)[:limit]
    
    @staticmethod
    def get_transaction_history(user_id: int, limit: int = 20) -> List[dict]:
        """Obtém histórico de transações do usuário"""
        user_data = BalanceManager.get_user_data(user_id)
        transactions = user_data.get("transactions", [])
        return sorted(transactions, key=lambda x: x.get("timestamp", 0), reverse=True)[:limit]
    
    @staticmethod
    def calculate_bonus(amount: float) -> float:
        """Calcula o bônus para um valor de depósito"""
        config = BalanceManager._get_config()
        bonus_config = config.get("bonus", {})
        bonus_type = bonus_config.get("type", "disabled")
        bonus_value = bonus_config.get("value", 0)
        
        if bonus_type == "disabled" or bonus_value <= 0:
            return 0
        
        if bonus_type == "percentage":
            return amount * (bonus_value / 100)
        elif bonus_type == "fixed":
            return bonus_value
        
        return 0
    
    @staticmethod
    def calculate_usable_amount(user_id: int, purchase_amount: float) -> float:
        """Calcula quanto do saldo pode ser usado em uma compra"""
        config = BalanceManager._get_config()
        rules = config.get("rules", {})
        
        user_balance = BalanceManager.get_user_balance(user_id)
        
        if user_balance <= 0:
            return 0
        
        # Valor mínimo de uso
        min_usage = rules.get("min_usage_amount", 0) or 0
        if purchase_amount < min_usage:
            return 0
        
        # Valor máximo pelo saldo
        max_usable = min(user_balance, purchase_amount)
        
        # Limitação por porcentagem
        max_percentage = rules.get("max_usage_percentage", 100) or 100
        max_by_percentage = purchase_amount * (max_percentage / 100)
        max_usable = min(max_usable, max_by_percentage)
        
        # Limitação por valor máximo
        max_amount = rules.get("max_usage_amount")
        if max_amount and max_amount > 0:
            max_usable = min(max_usable, max_amount)
        
        return max(0, max_usable)
