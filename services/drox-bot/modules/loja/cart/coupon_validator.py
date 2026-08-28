"""
Sistema unificado de validação de cupons.

Suporta cupons de produto e cupons em massa. As funções públicas mantêm os
mesmos contratos usados pelo fluxo de checkout.
"""
from datetime import datetime, timezone
from numbers import Real
from typing import Any, Dict, Optional, Tuple

import disnake

from functions.database import database as db


class CouponValidator:
    """Valida e registra o uso de cupons da loja."""

    @staticmethod
    def _normalize_code(coupon_code: Any) -> str:
        """Normaliza o código sem falhar quando a entrada vier vazia ou nula."""
        return str(coupon_code or "").strip().casefold()

    @staticmethod
    def _number(value: Any, default: float = 0.0) -> float:
        """Converte valores persistidos para número, descartando dados inválidos."""
        if isinstance(value, bool):
            return float(value)
        if isinstance(value, Real):
            return float(value)
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _timestamp(value: Any) -> Optional[float]:
        """Retorna um timestamp válido ou ``None`` para valores corrompidos."""
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _discount_from_percent(purchase_value: float, percent: Any) -> float:
        """Calcula um desconto percentual sempre dentro do valor da compra."""
        percentage = max(0.0, CouponValidator._number(percent))
        return min(purchase_value, purchase_value * (percentage / 100.0))

    @staticmethod
    def validate_product_coupon(
        coupon_code: str,
        product_id: str,
        user_id: int,
        purchase_value: float,
    ) -> Tuple[bool, str, float, Optional[dict]]:
        """Valida um cupom específico de produto.

        Retorna ``(is_valid, error_message, discount_amount, coupon_data)``.
        """
        del user_id  # Mantido na assinatura por compatibilidade.
        products = db.get_document("loja_products") or {}
        product = products.get(product_id, {}) if isinstance(products, dict) else {}
        cupons = product.get("cupons", {}) if isinstance(product, dict) else {}
        if not isinstance(cupons, dict):
            return False, "Cupom não encontrado para este produto", 0.0, None

        normalized_code = CouponValidator._normalize_code(coupon_code)
        coupon_data = None
        for cdata in cupons.values():
            if isinstance(cdata, dict) and CouponValidator._normalize_code(cdata.get("name")) == normalized_code:
                coupon_data = cdata
                break

        if not coupon_data:
            return False, "Cupom não encontrado para este produto", 0.0, None
        if not coupon_data.get("active", True):
            return False, "Cupom desativado", 0.0, None

        expires_at = CouponValidator._timestamp(coupon_data.get("expires_at"))
        if expires_at is not None and datetime.now(timezone.utc).timestamp() > expires_at:
            return False, "Cupom expirado", 0.0, None

        max_uses = CouponValidator._number(coupon_data.get("max_uses"), 0.0)
        uses_count = CouponValidator._number(coupon_data.get("uses_count"), 0.0)
        if max_uses > 0 and uses_count >= max_uses:
            return False, "Cupom esgotado", 0.0, None

        purchase_value = max(0.0, CouponValidator._number(purchase_value))
        min_cart = CouponValidator._number(coupon_data.get("min_cart"), 0.0)
        if min_cart > 0 and purchase_value < min_cart:
            return False, f"Valor mínimo: R$ {min_cart:.2f}", 0.0, None

        max_cart = CouponValidator._number(coupon_data.get("max_cart"), 0.0)
        if max_cart > 0 and purchase_value > max_cart:
            return False, f"Valor máximo: R$ {max_cart:.2f}", 0.0, None

        discount = CouponValidator._discount_from_percent(purchase_value, coupon_data.get("percent"))
        return True, "", discount, coupon_data

    @staticmethod
    def validate_mass_coupon(
        coupon_code: str,
        user_id: int,
        purchase_value: float,
        guild: disnake.Guild,
    ) -> Tuple[bool, str, float, Optional[dict]]:
        """Valida um cupom em massa.

        Retorna ``(is_valid, error_message, discount_amount, coupon_data)``.
        """
        data = db.get_document("loja_mass_coupons") or {}
        coupons = data.get("coupons", {}) if isinstance(data, dict) else {}
        normalized_code = CouponValidator._normalize_code(coupon_code)

        coupon = next(
            (
                value
                for key, value in coupons.items()
                if CouponValidator._normalize_code(key) == normalized_code
                and isinstance(value, dict)
            ),
            None,
        ) if isinstance(coupons, dict) else None
        if coupon is None:
            return False, "Cupom não encontrado", 0.0, None

        expiration = CouponValidator._timestamp(coupon.get("expiration"))
        if expiration is not None and datetime.now(timezone.utc).timestamp() > expiration:
            return False, "Cupom expirado", 0.0, None

        max_uses = CouponValidator._number(coupon.get("max_uses"), 0.0)
        uses = CouponValidator._number(coupon.get("uses"), 0.0)
        if max_uses > 0 and uses >= max_uses:
            return False, "Cupom esgotado", 0.0, None

        used_by = coupon.get("used_by", [])
        used_by = used_by if isinstance(used_by, list) else []
        if user_id in used_by or str(user_id) in used_by:
            return False, "Você já usou este cupom", 0.0, None

        purchase_value = max(0.0, CouponValidator._number(purchase_value))
        min_purchase = CouponValidator._number(coupon.get("min_purchase"), 0.0)
        if min_purchase > 0 and purchase_value < min_purchase:
            return False, f"Compra mínima: R$ {min_purchase:.2f}", 0.0, None

        max_purchase = CouponValidator._number(coupon.get("max_purchase"), 0.0)
        if max_purchase > 0 and purchase_value > max_purchase:
            return False, f"Compra máxima: R$ {max_purchase:.2f}", 0.0, None

        required_role = coupon.get("required_role")
        if required_role:
            if guild is None:
                return False, "Não foi possível verificar o cargo obrigatório", 0.0, None
            member = guild.get_member(user_id)
            if member is None:
                return False, "Membro não encontrado", 0.0, None
            try:
                role = guild.get_role(int(required_role))
            except (TypeError, ValueError):
                role = None
            if role is not None and role not in member.roles:
                return False, f"Cargo obrigatório: {role.name}", 0.0, None

        discount_type = str(coupon.get("discount_type", "")).casefold()
        if discount_type == "porcentagem":
            discount = CouponValidator._discount_from_percent(
                purchase_value, coupon.get("discount_value")
            )
            max_discount = CouponValidator._number(coupon.get("max_discount"), 0.0)
            if max_discount > 0:
                discount = min(discount, max_discount)
        else:
            discount = min(purchase_value, max(0.0, CouponValidator._number(coupon.get("discount_value"))))

        return True, "", discount, coupon

    @staticmethod
    def validate_coupon(
        coupon_code: str,
        product_id: str,
        user_id: int,
        purchase_value: float,
        guild: disnake.Guild,
    ) -> Tuple[bool, str, float, str, Optional[dict]]:
        """Valida primeiro o cupom do produto e depois o cupom em massa."""
        result = CouponValidator.validate_product_coupon(
            coupon_code, product_id, user_id, purchase_value
        )
        if result[0]:
            return True, "", result[2], "product", result[3]

        result = CouponValidator.validate_mass_coupon(
            coupon_code, user_id, purchase_value, guild
        )
        if result[0]:
            return True, "", result[2], "mass", result[3]

        return False, result[1], 0.0, "", None

    @staticmethod
    def use_product_coupon(product_id: str, coupon_code: str, user_id: int):
        """Marca o cupom de produto como usado."""
        del user_id  # Mantido na assinatura por compatibilidade.
        products = db.get_document("loja_products") or {}
        if not isinstance(products, dict):
            return
        product = products.get(product_id, {})
        cupons = product.get("cupons", {}) if isinstance(product, dict) else {}
        if not isinstance(cupons, dict):
            return

        normalized_code = CouponValidator._normalize_code(coupon_code)
        for coupon in cupons.values():
            if isinstance(coupon, dict) and CouponValidator._normalize_code(coupon.get("name")) == normalized_code:
                coupon["uses_count"] = int(CouponValidator._number(coupon.get("uses_count"), 0.0)) + 1
                coupon["updated_at"] = int(datetime.now(timezone.utc).timestamp())
                db.save_document("loja_products", products)
                return

    @staticmethod
    def use_mass_coupon(coupon_code: str, user_id: int):
        """Marca um cupom em massa como usado, sem duplicar o usuário."""
        data = db.get_document("loja_mass_coupons") or {}
        coupons = data.get("coupons", {}) if isinstance(data, dict) else {}
        if not isinstance(coupons, dict):
            return

        normalized_code = CouponValidator._normalize_code(coupon_code)
        for key, coupon in coupons.items():
            if CouponValidator._normalize_code(key) != normalized_code or not isinstance(coupon, dict):
                continue
            coupon["uses"] = int(CouponValidator._number(coupon.get("uses"), 0.0)) + 1
            used_by = coupon.get("used_by", [])
            coupon["used_by"] = used_by if isinstance(used_by, list) else []
            if user_id not in coupon["used_by"] and str(user_id) not in coupon["used_by"]:
                coupon["used_by"].append(user_id)
            db.save_document("loja_mass_coupons", data)
            return

    @staticmethod
    def use_coupon(coupon_code: str, coupon_type: str, product_id: str, user_id: int):
        """Marca o cupom como usado (produto ou massa)."""
        if coupon_type == "product":
            CouponValidator.use_product_coupon(product_id, coupon_code, user_id)
        elif coupon_type == "mass":
            CouponValidator.use_mass_coupon(coupon_code, user_id)

    @staticmethod
    def is_free_coupon(discount_amount: float, total_price: float) -> bool:
        """Verifica se o cupom torna a compra gratuita."""
        discount = CouponValidator._number(discount_amount)
        total = CouponValidator._number(total_price)
        return discount >= total and total > 0
