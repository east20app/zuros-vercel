"""Configuração da integração diretamente pelo painel Cloud."""
import disnake
from functions.emoji import emoji
from functions.database import database as db
from functions.message import message,embed_message
from .zuros_cloud import DEFAULT_BACKEND_URL,ZurosCloud,ZurosCloudError,get_zuros_credentials,is_zuros_configured,save_zuros_credentials
CALLBACK_URL="https://zuros-auth.vercel.app/oauth/callback"
class ZurosKeyModal(disnake.ui.Modal):
    def __init__(self):
        current=get_zuros_credentials()
        super().__init__(title="Conectar Zuros Auth",custom_id="zuros_key_modal",components=[
            disnake.ui.TextInput(label="Auth ID",custom_id="auth_id",style=disnake.TextInputStyle.short,
                required=True,max_length=150,value=current.get("auth_id") or "",placeholder="Auth ID do painel Zuros"),
            disnake.ui.TextInput(label="Bot Credential / Key",custom_id="bot_credential",
                style=disnake.TextInputStyle.paragraph,required=True,max_length=1500,
                placeholder="Cole a key gerada na Zuros Auth")])
    async def callback(self,inter):
        await inter.response.defer(ephemeral=True)
        auth_id=inter.text_values["auth_id"].strip()
        credential=inter.text_values["bot_credential"].strip()
        candidate=ZurosCloud(DEFAULT_BACKEND_URL,auth_id,credential)
        try: await candidate.status()
        except ZurosCloudError as error:
            await inter.edit_original_response(content=f"{emoji.wrong} Key recusada: {error}"); return
        finally: await candidate.close()
        save_zuros_credentials(auth_id,credential)
        await inter.edit_original_response(content=f"{emoji.correct} Zuros Auth conectada pelo painel Cloud. A key não será exibida.")
def _description():
    current=get_zuros_credentials(); state="Configurado" if is_zuros_configured() else "Não configurado"
    auth_id=current.get("auth_id") or "não informado"
    return f"""**Integração Zuros Auth**

Clique em **Colocar Key** e informe o Auth ID e a Bot Credential gerados no painel Zuros.
A credencial é validada antes de ser salva e nunca é mostrada novamente.

Callback: {CALLBACK_URL}
**Auth ID:** {auth_id}
**Estado:** {state}"""
def _actions():
    return disnake.ui.ActionRow(
        disnake.ui.Button(label="Colocar Key",style=disnake.ButtonStyle.green,
            custom_id="Cloud_SetCredentialsModal",emoji=emoji.double_check),
        disnake.ui.Button(label="Callback",style=disnake.ButtonStyle.grey,
            custom_id="Cloud_CopyAuthURL",emoji=emoji.web))
def CredentialsView_components():
    colors=db.get_document("custom_colors") or {}; kwargs={}
    if colors.get("primary"): kwargs["accent_colour"]=disnake.Colour(int(colors["primary"].replace("#",""),16))
    return [disnake.ui.Container(disnake.ui.TextDisplay(f"# {emoji.zuros}\n-# Painel > Zuros Auth > **Integração**"),
        disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small),disnake.ui.TextDisplay(_description()),_actions(),**kwargs),
        disnake.ui.ActionRow(disnake.ui.Button(label="Voltar",style=disnake.ButtonStyle.grey,
            emoji=emoji.back,custom_id="Cloud_MainPanel"))]
def CredentialsView_embed(inter):
    embed=disnake.Embed(title="Integração Zuros Auth",description=_description())
    return embed,[_actions(),disnake.ui.ActionRow(disnake.ui.Button(label="Voltar",
        style=disnake.ButtonStyle.grey,emoji=emoji.back,custom_id="Cloud_MainPanel"))]
async def show_panel(inter):
    mode=(db.get_document("custom_mode") or {}).get("mode")
    if mode=="embed":
        await embed_message.wait(inter); embed,components=CredentialsView_embed(inter)
        await inter.edit_original_message(content=None,embed=embed,components=components)
    else:
        await message.wait(inter); await inter.edit_original_message(components=CredentialsView_components())
