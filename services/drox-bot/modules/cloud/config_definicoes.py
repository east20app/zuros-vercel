import disnake
from functions.database import database as db
from functions.emoji import emoji

SETTINGS = {"require_oauth2": {"label": "Exigir Zuros Auth nos recursos protegidos", "description": "Bloqueia recursos protegidos ate o usuario concluir a verificacao."}}

def get_definicoes_data():
    return (db.get_document("cloud_data") or {}).get("definitions", {})

def _status_text():
    data = get_definicoes_data()
    return "\n".join(f"{emoji.on if data.get(key, {}).get('enabled', False) else emoji.off} **{value['label']}**" for key, value in SETTINGS.items())

def _select():
    return disnake.ui.ActionRow(disnake.ui.StringSelect(custom_id="CloudDefinicoes_Select", placeholder="Selecione para ativar ou desativar", options=[disnake.SelectOption(label=value["label"], value=key, emoji=emoji.power, description=value["description"]) for key, value in SETTINGS.items()]))

def DefinicoesView_components(inter):
    colors = db.get_document("custom_colors") or {}
    kwargs = {}
    if colors.get("primary"):
        kwargs["accent_colour"] = disnake.Colour(int(colors["primary"].replace("#", ""), 16))
    return [disnake.ui.Container(disnake.ui.TextDisplay(f"# {emoji.zuros}\n-# Painel > Zuros Auth > **Preferencias**"), disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small), disnake.ui.TextDisplay(_status_text()), _select(), **kwargs), disnake.ui.ActionRow(disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="Cloud_Back"))]

def DefinicoesView_embed(inter):
    colors = db.get_document("custom_colors") or {}
    embed = disnake.Embed(title="Preferencias Zuros Auth", description=_status_text())
    if colors.get("primary"):
        embed.color = int(colors["primary"].replace("#", ""), 16)
    return embed, [_select(), disnake.ui.ActionRow(disnake.ui.Button(label="Voltar", style=disnake.ButtonStyle.grey, emoji=emoji.back, custom_id="Cloud_Back"))]