from datetime import datetime

import discord

from .models import Application


def application_embed(app: Application) -> discord.Embed:
    color = 0x35C46A if app.online else 0x64748B
    embed = discord.Embed(
        title=app.name, color=color, description="Controle seguro da sua aplicação ZUROS."
    )
    embed.add_field(name="Bot", value="Online 🟢" if app.online else "Offline ⚪", inline=True)
    embed.add_field(name="Assinatura", value=app.status.replace("_", " ").title(), inline=True)
    embed.add_field(name="Versão", value=f"v{app.version}", inline=True)
    if app.lifetime:
        expiry = "Vitalício"
    elif app.expires_at:
        try:
            value = datetime.fromisoformat(app.expires_at.replace("Z", "+00:00"))
            expiry = f"<t:{int(value.timestamp())}:R>"
        except ValueError:
            expiry = app.expires_at
    else:
        expiry = "Não informado"
    embed.add_field(name="Expiração", value=expiry, inline=True)
    embed.add_field(name="Servidor principal", value=app.server_id or "Não definido", inline=True)
    embed.add_field(
        name="Atualização", value="Pendente" if app.force_update else "Em dia", inline=True
    )
    embed.set_footer(text="ZUROS • As ações são aplicadas pela API oficial")
    return embed


def application_panel_text(app: Application, notice: str | None = None) -> str:
    if app.lifetime:
        expiry = "Vitalício"
    elif app.expires_at:
        try:
            value = datetime.fromisoformat(app.expires_at.replace("Z", "+00:00"))
            expiry = f"<t:{int(value.timestamp())}:R>"
        except ValueError:
            expiry = app.expires_at
    else:
        expiry = "Não informado"

    state = "🟢 Online" if app.online else "🔴 Offline"
    update = "Pendente" if app.force_update else "Em dia"
    lines = [
        f"## {app.name}",
        "Controle sua aplicação com segurança pela API oficial ZUROS.",
        "",
        f"**Estado**  {state}",
        f"**Assinatura**  {app.status.replace('_', ' ').title()}",
        f"**Versão**  v{app.version}",
        f"**Expiração**  {expiry}",
        f"**Servidor principal**  {app.server_id or 'Não definido'}",
        f"**Atualização**  {update}",
    ]
    if notice:
        lines.extend(("", f"✅ **{notice}**"))
    return "\n".join(lines)


def error_message(error: Exception) -> str:
    request_id = getattr(error, "request_id", "")
    suffix = f"\nCódigo de atendimento: `{request_id}`" if request_id else ""
    return f"Não foi possível concluir: {error}{suffix}"
