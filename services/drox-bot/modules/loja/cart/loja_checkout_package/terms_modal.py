"""
Modal para aceitação de termos da loja
"""

import disnake
from functions.database import database as db
from functions.emoji import emoji
from modules.loja.preferences.utils import get_terms


class TermsAcceptanceModal(disnake.ui.Modal):
    """Modal para aceitar termos da loja"""
    
    def __init__(self, cart_id: str):
        self.cart_id = cart_id
        
        terms_enabled, terms_text = get_terms()
        self.no_terms = not terms_enabled or not terms_text

        # O fluxo normal não abre este modal quando não há termos. Ainda assim,
        # mantemos a classe completamente inicializada para chamadas antigas.
        display_text = (
            terms_text[:1500] + "..."
            if isinstance(terms_text, str) and len(terms_text) > 1500
            else (terms_text or "Nenhum termo informado.")
        )
        
        components = [
            disnake.ui.TextInput(
                label="Termos da Loja",
                custom_id="terms_display",
                value=display_text,
                style=disnake.TextInputStyle.paragraph,
                required=False,
                max_length=2000
            ),
            disnake.ui.TextInput(
                label="Digite 'ACEITO' para prosseguir",
                custom_id="terms_acceptance",
                style=disnake.TextInputStyle.short,
                required=True,
                max_length=10,
                placeholder="ACEITO"
            )
        ]
        super().__init__(title="Aceitar Termos da Loja", components=components)
    
    async def callback(self, inter: disnake.ModalInteraction):
        # Fazer defer imediatamente para evitar timeout
        if not inter.response.is_done():
            await inter.response.defer(ephemeral=True)
        
        acceptance = inter.text_values.get("terms_acceptance", "").strip().upper()
        
        if acceptance != "ACEITO":
            await inter.followup.send(
                f"{emoji.wrong} Você precisa digitar 'ACEITO' para prosseguir com a compra.",
                ephemeral=True
            )
            return
        
        # Marcar termos como aceitos no carrinho
        loja_data = db.get_document("loja_data") or {}
        if not isinstance(loja_data, dict):
            loja_data = {}
        carts = loja_data.get("carts", {})
        carts = carts if isinstance(carts, dict) else {}
        cart = carts.get(self.cart_id)
        
        if not cart:
            await inter.followup.send(
                f"{emoji.wrong} Carrinho não encontrado!",
                ephemeral=True
            )
            return
        
        cart["terms_accepted"] = True
        cart["terms_accepted_at"] = int(disnake.utils.utcnow().timestamp())
        loja_data["carts"] = carts
        carts[self.cart_id] = cart
        db.save_document("loja_data", loja_data)
        
        # Informar que os termos foram aceitos
        await inter.followup.send(
            f"{emoji.correct} Termos aceitos! Agora você pode continuar com o pagamento clicando no botão 'Continuar com o Carrinho'.",
            ephemeral=True
        )

