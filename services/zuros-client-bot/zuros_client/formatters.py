from datetime import datetime

from .emojis import emoji
from .models import Application
from .theme import FOOTER


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

    state = f"{emoji.online} Online" if app.online else f"{emoji.off} Offline"
    update = "Pendente" if app.force_update else "Em dia"
    lines = [
        f"## {app.name}",
        "Controle sua aplicação com segurança pela API oficial ZUROS.",
        "",
        f"- **Estado:** {state}",
        f"- **Assinatura:** {app.status.replace('_', ' ').title()}",
        f"- **Versão:** v{app.version}",
        f"- **Expiração:** {expiry}",
        f"- **Servidor principal:** {app.server_id or 'Não definido'}",
        f"- **Atualização:** {update}",
    ]
    if notice:
        lines.extend(("", f"{emoji.correct} **{notice}**"))
    lines.extend(("", FOOTER.format(tagline="Controle seguro pela API oficial")))
    return "\n".join(lines)


def error_message(error: Exception) -> str:
    request_id = getattr(error, "request_id", "")
    suffix = f"\nCódigo de atendimento: `{request_id}`" if request_id else ""
    return f"Não foi possível concluir: {error}{suffix}"
