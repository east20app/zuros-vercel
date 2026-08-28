import os
import disnake
from functions.emoji import emoji
from functions.database import database as db
from .zuros_cloud import ZurosCloudError, get_zuros_cloud, is_zuros_configured

async def get_status_text(inter: disnake.Interaction):
    configured = is_zuros_configured()
    verified_members, online = 0, False
    if configured:
        try:
            status = await get_zuros_cloud().status()
            verified_members = int(status.get("verified_count", 0))
            online = True
        except (ZurosCloudError, TypeError, ValueError):
            pass
    cloud_config = db.get_document("cloud_data") or {}
    log_channel_id = cloud_config.get("log_channel_id")
    logs_channel = f"<#{log_channel_id}>" if log_channel_id else "`Nao definido`"
    cargos_config = db.get_document("cargos") or {}
    role_id = cargos_config.get("cargo_verificado")
    role = f"<@&{role_id}>" if role_id else "`Gerenciado pelo painel Zuros Auth`"
    status_label = "`Conectado ao Zuros Auth`" if online else ("`Credenciais invalidas ou API offline`" if configured else "`Variaveis de ambiente ausentes`")
    status_emoji = emoji.on if online else emoji.off
    return f"""{status_emoji} **Status:** {status_label}
{emoji.members} **Membros Verificados:** `{verified_members}`
{emoji.textc} **Canal de Logs:** {logs_channel}
{emoji.role} **Cargo de Verificado:** {role}"""

class LogChannelModal(disnake.ui.Modal):
    def __init__(self, bot, current_channel_id: str = ""):
        self.bot = bot
        components = [disnake.ui.Label(
            text="Selecione o Canal de Logs",
            component=disnake.ui.ChannelSelect(placeholder="Escolha um canal de texto", custom_id="log_channel_select", channel_types=[disnake.ChannelType.text], min_values=1, max_values=1),
            description="Canal usado para logs de verificacao.",
        )]
        super().__init__(title="Definir Canal de Logs", components=components, custom_id="log_channel_modal")

    async def callback(self, inter: disnake.ModalInteraction):
        selected = inter.resolved_values.get("log_channel_select")
        if isinstance(selected, (list, tuple)):
            selected = selected[0] if selected else None
        channel_id = str(selected.id if hasattr(selected, "id") else selected) if selected else None
        cloud_cog = self.bot.get_cog("Cloud")
        if cloud_cog:
            await cloud_cog.process_log_channel(inter, channel_id)