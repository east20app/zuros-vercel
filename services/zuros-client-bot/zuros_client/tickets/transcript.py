import html
import io
from datetime import datetime

import discord


async def build_transcript(channel: discord.TextChannel) -> discord.File:
    entries: list[str] = []
    async for message in channel.history(limit=None, oldest_first=True):
        timestamp = message.created_at.astimezone().strftime("%d/%m/%Y %H:%M:%S")
        content = html.escape(message.content or "")
        attachments = "".join(
            f'<div><a href="{html.escape(item.url)}">{html.escape(item.filename)}</a></div>'
            for item in message.attachments
        )
        entries.append(
            "<article><header><strong>"
            + html.escape(str(message.author))
            + f"</strong><span>{timestamp}</span></header><p>{content}</p>{attachments}</article>"
        )
    document = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Transcript {html.escape(channel.name)}</title><style>
    body{{background:#0b0d12;color:#dce4ef;font:14px system-ui;margin:0;padding:32px}}
    main{{max-width:860px;margin:auto}}h1{{font-size:22px}}
    article{{border-top:1px solid #202938;padding:16px 0}}
    header{{display:flex;gap:12px;justify-content:space-between}}span{{color:#748197;font-size:12px}}
    p{{white-space:pre-wrap;line-height:1.55}}a{{color:#60a5fa}}</style></head><body><main>
    <h1>Ticket #{html.escape(channel.name)}</h1>
    <p>Gerado em {datetime.now().astimezone():%d/%m/%Y %H:%M}</p>
    {''.join(entries)}</main></body></html>"""
    return discord.File(
        io.BytesIO(document.encode("utf-8")), filename=f"transcript-{channel.name}.html"
    )
