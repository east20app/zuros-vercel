"""
Drox UI Kit - Centralized theme and layout system
Defines styling constants and helpers to unify presentation across embeds and components.
"""
import disnake
import time
from functions.database import database as db

# Padrão de Cores Drox UI Kit
COLOR_PRIMARY = "#00CBA4"      # Verde Água (sucesso, CTAs, destaque)
COLOR_BACKGROUND = "#2B2D31"   # Cinza Escuro (fundo estilo Discord)
COLOR_WARNING = "#FFB800"      # Amarelo (avisos, alertas)
COLOR_ERROR = "#FF4757"        # Vermelho (falhas, exclusões, destrutivas)
COLOR_INFO = "#5865F2"         # Blurple (ações neutras, links)

DEFAULT_FOOTER = "Zuros Bot • Excelência em Automação"

def get_color(color_hex: str) -> disnake.Colour:
    """Converte um hex code de cor (ex: #00CBA4) para disnake.Colour"""
    try:
        return disnake.Colour(int(color_hex.replace("#", ""), 16))
    except Exception:
        return disnake.Colour(int(COLOR_PRIMARY.replace("#", ""), 16))

def build_panel(
    title: str,
    description: str,
    color: str = COLOR_PRIMARY,
    fields: list = None,
    footer: bool = True,
    mode: str = None
):
    """
    Constrói um painel padronizado de acordo com o Drox UI Kit.
    Retorna disnake.Embed ou disnake.ui.Container dependendo do modo do bot (embed/components).
    
    Args:
        title: Título da seção/painel
        description: Conteúdo/texto principal
        color: Cor do accent do painel (hex string)
        fields: Lista de tuplas (nome, valor, inline) para campos de informação adicionais
        footer: Define se exibe o rodapé padrão do Drox Bot
        mode: Força um modo específico ('embed' ou 'components'). Se None, lê do banco.
    """
    if fields is None:
        fields = []

    # 1. Determinar modo (embed ou components)
    if not mode:
        try:
            mode = db.get_document("custom_mode").get("mode", "components")
        except Exception:
            mode = "components"

    # 2. Obter cor primária personalizada, se configurada no painel e solicitada
    if color == COLOR_PRIMARY:
        try:
            colors = db.get_document("custom_colors") or {}
            color_hex = colors.get("primary", COLOR_PRIMARY)
        except Exception:
            color_hex = COLOR_PRIMARY
    else:
        color_hex = color

    disnake_color = get_color(color_hex)

    if mode == "embed":
        embed = disnake.Embed(
            title=title,
            description=description,
            color=disnake_color
        )
        for name, value, inline in fields:
            embed.add_field(name=name, value=value, inline=inline)
        if footer:
            embed.set_footer(text=DEFAULT_FOOTER)
        return embed
    else:
        # Modo Components v2 (Containers)
        children = [
            disnake.ui.TextDisplay(f"# {title}"),
            disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small)
        ]

        if description:
            children.append(disnake.ui.TextDisplay(description))
            children.append(disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small))

        for name, value, _ in fields:
            children.append(disnake.ui.TextDisplay(f"**{name}**\n{value}"))
            children.append(disnake.ui.Separator(spacing=disnake.SeparatorSpacing.small))

        if footer:
            children.append(disnake.ui.TextDisplay(f"-# {DEFAULT_FOOTER}"))

        # Remove o último separador se existir para um acabamento limpo
        if len(children) > 2 and isinstance(children[-1], disnake.ui.Separator):
            children.pop()

        return disnake.ui.Container(*children, accent_colour=disnake_color)
