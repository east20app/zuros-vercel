"""Proteção compartilhada de recursos com comportamento fail-closed."""
from __future__ import annotations
import disnake
from .verification_view import VerificationView
from .zuros_cloud import get_zuros_cloud, is_zuros_configured
from .zuros_client import ZurosError

async def is_user_verified(member: disnake.Member) -> bool:
    if not is_zuros_configured():
        return False
    try:
        return (await get_zuros_cloud().check_verification(member.id)).verified
    except ZurosError:
        return False

async def require_zuros_verification(inter: disnake.Interaction) -> bool:
    """Retorna True somente se pode continuar; falhas da API bloqueiam."""
    if inter.guild is None:
        return True
    if not is_zuros_configured():
        await _deny(inter, "A verificação está temporariamente indisponível (integração não configurada).")
        return False
    member = inter.user if isinstance(inter.user, disnake.Member) else inter.guild.get_member(inter.user.id)
    try:
        verified = member is not None and (
            await get_zuros_cloud().check_verification(member.id)).verified
    except ZurosError:
        await _deny(inter, "Não foi possível confirmar sua verificação agora. Tente novamente em instantes.")
        return False
    if verified:
        return True
    await _deny(inter, "Este recurso exige verificação. Use o botão abaixo.")
    return False

async def _deny(inter, text):
    kwargs={"content":text,"ephemeral":True}
    if is_zuros_configured():
        kwargs["view"]=VerificationView(get_zuros_cloud())
    if inter.response.is_done(): await inter.followup.send(**kwargs)
    else: await inter.response.send_message(**kwargs)

async def send_verification_required_message(inter):
    return not await require_zuros_verification(inter)

def is_verification_required(): return is_zuros_configured()

def get_verification_message_and_view(inter):
    if inter.guild is None or not is_zuros_configured(): return None, None
    return "Este servidor exige verificação.", VerificationView(get_zuros_cloud())
