export type EmailField = { label: string; value: string };
export type EmailCta = { label: string; href: string };
export type RenderEmailInput = {
    preheader?: string;
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    greeting?: string;
    intro?: string;
    fields?: EmailField[];
    note?: string;
    primaryCta: EmailCta;
    secondaryCta?: EmailCta;
    campaign: string;
    footerNote?: string;
};

export function esc(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char); }
export function absoluteUrl(path: string, campaign: string): string {
    const base = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const raw = /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const separator = raw.includes("?") ? "&" : "?";
    return `${raw}${separator}utm_source=email&utm_medium=transactional&utm_campaign=${encodeURIComponent(campaign)}`;
}
export function renderButton(button: EmailCta, campaign: string, secondary = false): string {
    const background = secondary ? "#1F2937" : "#D6FF63";
    const color = secondary ? "#F8FAFC" : "#0B0F14";
    return `<a href="${esc(absoluteUrl(button.href, campaign))}" style="display:inline-block;padding:13px 17px;border-radius:6px;background:${background};color:${color};font-size:13px;font-weight:700;line-height:1;text-decoration:none;">${esc(button.label)}</a>`;
}
export function renderFieldsTable(fields: EmailField[]): string {
    if (!fields.length) return "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">${fields.map((field) => `<tr><td style="padding:10px 0;border-bottom:1px solid #1F2937;color:#94A3B8;font-size:13px;">${esc(field.label)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #1F2937;color:#F8FAFC;font-size:13px;font-weight:700;">${esc(field.value)}</td></tr>`).join("")}</table>`;
}
function plainText(input: RenderEmailInput): string {
    const lines = [input.preheader || input.heroTitle, "", input.greeting, input.intro, "", ...(input.fields || []).map((field) => `${field.label}: ${field.value}`), input.note, "", `Ação: ${input.primaryCta.label} — ${input.primaryCta.href}`, input.secondaryCta ? `Ação: ${input.secondaryCta.label} — ${input.secondaryCta.href}` : "", input.footerNote].filter((value): value is string => Boolean(value));
    return lines.join("\n");
}
export function renderEmail(input: RenderEmailInput): { html: string; text: string } {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(input.heroTitle)}</title></head><body style="margin:0;padding:0;background:#0B0F14;color:#F8FAFC;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(input.preheader || input.heroTitle)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F14;"><tr><td align="center" style="padding:28px 14px 44px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;"><tr><td style="padding:8px 4px 22px;"><span style="color:#D6FF63;font-size:15px;font-weight:800;letter-spacing:.22em;">ZUROS</span><span style="float:right;color:#94A3B8;font-size:11px;line-height:20px;">PLATAFORMA</span></td></tr><tr><td style="background:#111827;border:1px solid #1F2937;border-radius:8px;padding:34px 30px 30px;"><p style="margin:0 0 12px;color:#D6FF63;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">${esc(input.eyebrow)}</p><h1 style="margin:0;color:#F8FAFC;font-size:27px;line-height:1.2;letter-spacing:-.03em;">${esc(input.heroTitle)}</h1><p style="margin:16px 0 0;color:#94A3B8;font-size:15px;line-height:1.65;">${esc(input.heroSubtitle)}</p>${input.greeting ? `<p style="margin:22px 0 0;color:#F8FAFC;font-size:15px;line-height:1.65;">${esc(input.greeting)}</p>` : ""}${input.intro ? `<p style="margin:12px 0 0;color:#94A3B8;font-size:14px;line-height:1.65;">${esc(input.intro)}</p>` : ""}${renderFieldsTable(input.fields || [])}${input.note ? `<p style="margin:22px 0 0;padding:15px;border-left:2px solid #D6FF63;background:#0B0F14;color:#CBD5E1;font-size:13px;line-height:1.65;white-space:pre-wrap;">${esc(input.note)}</p>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:27px 0 8px;"><tr><td>${renderButton(input.primaryCta, input.campaign)}</td>${input.secondaryCta ? `<td style="padding-left:8px;">${renderButton(input.secondaryCta, input.campaign, true)}</td>` : ""}</tr></table>${input.footerNote ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #1F2937;color:#94A3B8;font-size:12px;line-height:1.6;">${esc(input.footerNote)}</p>` : ""}</td></tr><tr><td style="padding:22px 4px 0;color:#64748B;font-size:11px;line-height:1.7;">Você recebeu este e-mail por causa de uma atividade na sua conta ZUROS.<br><a href="${esc(absoluteUrl("/dashboard", input.campaign))}" style="color:#94A3B8;">Dashboard</a> · <a href="${esc(absoluteUrl("/status", input.campaign))}" style="color:#94A3B8;">Status</a> · <a href="${esc(absoluteUrl("/suporte", input.campaign))}" style="color:#94A3B8;">Suporte</a> · <a href="${esc(absoluteUrl("/termos", input.campaign))}" style="color:#94A3B8;">Termos</a> · <a href="${esc(absoluteUrl("/privacidade", input.campaign))}" style="color:#94A3B8;">Privacidade</a><br><span style="color:#475569;">© ZUROS — comunicação transacional automática.</span></td></tr></table></td></tr></table></body></html>`;
    return { html, text: plainText(input) };
}
