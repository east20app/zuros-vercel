import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import databases from "@root/src/databases";

export const runtime = "nodejs";

const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const HOURLY_SEND_LIMIT = 5;

function normalizeEmail(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function codeHash(email: string, code: string): string {
    return crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev-insecure-secret").update(`${email}:${code}`).digest("hex");
}

function emailUserId(email: string): string {
    return `email:${crypto.createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
}

function configured(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`A variável ${name} não está configurada.`);
    return value;
}

function smtpConfig() {
    const port = Number(process.env.EMAIL_SERVER_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("EMAIL_SERVER_PORT inválida.");
    return {
        host: configured("EMAIL_SERVER_HOST"),
        port,
        secure: process.env.EMAIL_SERVER_SECURE === "true",
        auth: { user: configured("EMAIL_SERVER_USER"), pass: configured("EMAIL_SERVER_PASSWORD") },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
        requireTLS: !process.env.EMAIL_SERVER_SECURE || process.env.EMAIL_SERVER_SECURE === "false",
        from: configured("EMAIL_FROM"),
    };
}

function loginEmailText(code: string): string {
    return [
        "ZUROS — Seu código de acesso",
        "",
        "Use o código abaixo para entrar no painel. Ele expira em 10 minutos e só pode ser usado uma vez.",
        "",
        `Código: ${code}`,
        "",
        "Não solicitou este código? Pode ignorar esta mensagem com segurança.",
    ].join("\n");
}

function loginEmailHtml(code: string): string {
    const base = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const dashboard = `${base}/dashboard` || "/dashboard";
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>Seu código de acesso à ZUROS</title></head><body style="margin:0;padding:0;background:#0B0F14;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Seu código de acesso à ZUROS expira em 10 minutos.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F14;"><tr><td align="center" style="padding:28px 14px 44px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;"><tr><td style="padding:8px 4px 22px;"><span style="color:#D6FF63;font-size:15px;font-weight:800;letter-spacing:.22em;">ZUROS</span><span style="float:right;color:#94A3B8;font-size:11px;">PLATAFORMA</span></td></tr><tr><td style="background:#111827;border:1px solid #1F2937;border-radius:8px;padding:34px 30px 30px;"><p style="margin:0 0 12px;color:#D6FF63;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Acesso seguro</p><h1 style="margin:0;color:#F8FAFC;font-size:27px;line-height:1.2;">Seu código de acesso</h1><p style="margin:16px 0 0;color:#94A3B8;font-size:15px;line-height:1.65;">Recebemos uma solicitação de login para sua conta. Use o código abaixo para abrir o dashboard. Ele expira em <strong style="color:#F8FAFC;">10 minutos</strong> e só pode ser usado uma vez.</p><div style="margin:26px 0;text-align:center;background:#0B0F14;border:1px solid #1F2937;border-radius:6px;padding:20px 14px;"><span style="color:#D6FF63;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:9px;">${code}</span></div><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr><td bgcolor="#D6FF63" style="border-radius:6px;"><a href="${dashboard}" style="display:inline-block;padding:13px 18px;color:#0B0F14;font-size:13px;font-weight:700;text-decoration:none;">Abrir dashboard</a></td></tr></table><p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #1F2937;color:#94A3B8;font-size:12px;line-height:1.6;">Não solicitou este código? Ignore esta mensagem com segurança. Nunca compartilhe seu código.</p></td></tr><tr><td style="padding:22px 4px 0;color:#64748B;font-size:11px;line-height:1.7;">Dashboard · Status · Suporte · Termos · Privacidade<br><span style="color:#475569;">© ZUROS — comunicação transacional automática.</span></td></tr></table></td></tr></table></body></html>`;
}
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
        }

        const smtp = smtpConfig();
        const users = databases.siteUsers;
        let user = await users.findOne({ email }).select("+emailLoginCodeRequestedAt +emailLoginSendCount +emailLoginSendWindowStart");
        const nowMs = Date.now();

        if (user?.emailLoginCodeRequestedAt && nowMs - user.emailLoginCodeRequestedAt.getTime() < REQUEST_COOLDOWN_MS) {
            return NextResponse.json({ ok: true, message: "Você já solicitou um código recentemente. Aguarde um instante para reenviar.", cooldown: true });
        }

        const windowStart = user?.emailLoginSendWindowStart;
        const sendCount = user?.emailLoginSendCount || 0;
        const inWindow = windowStart ? nowMs - windowStart.getTime() < HOURLY_WINDOW_MS : false;
        if (inWindow && sendCount >= HOURLY_SEND_LIMIT) {
            return NextResponse.json({ ok: false, error: "Muitos códigos solicitados para este e-mail. Tente novamente em uma hora." }, { status: 429 });
        }

        const now = new Date(nowMs);
        if (!user) {
            user = await users.create({
                discordId: emailUserId(email),
                name: email.split("@")[0].slice(0, 80) || "Usuário",
                email,
                authorizedGuildJoin: false,
                firstLoginAt: now,
                lastLoginAt: now,
                loginCount: 0,
            });
        }

        const code = crypto.randomInt(100000, 1000000).toString();
        await users.updateOne(
            { _id: user._id },
            { $set: { emailLoginCodeHash: codeHash(email, code), emailLoginCodeExpiresAt: new Date(nowMs + CODE_TTL_MS), emailLoginCodeRequestedAt: now, emailLoginCodeAttempts: 0, email, emailLoginSendWindowStart: inWindow && windowStart ? windowStart : now, emailLoginSendCount: inWindow ? sendCount + 1 : 1 }, $unset: { emailVerified: "" } },
        );

        const transporter = nodemailer.createTransport(smtp);
        try {
            await transporter.sendMail({
                from: smtp.from,
                to: email,
                subject: "Seu código de acesso à ZUROS",
                text: loginEmailText(code),
                html: loginEmailHtml(code),
            });
        } catch (error) {
            await users.updateOne({ _id: user._id }, { $unset: { emailLoginCodeHash: "", emailLoginCodeExpiresAt: "", emailLoginCodeRequestedAt: "", emailLoginCodeAttempts: "", emailLoginSendCount: "", emailLoginSendWindowStart: "" } });
            throw error;
        }

        return NextResponse.json({ ok: true, message: "Se o e-mail estiver cadastrado, um código foi enviado." });
    } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        console.error("[auth-email] Falha ao enviar código:", raw);
        let message: string;
        if (/não está configurada|inválida/i.test(raw)) {
            message = "O envio de e-mail ainda não está configurado corretamente.";
        } else if (/invalid login|authentication|535|relay denied|sender|mail from|5\.7\.0|5\.7\.1|550|554|530/i.test(raw)) {
            message = `O servidor de e-mail recusou o envio. Verifique usuário/senha e o remetente (From). Detalhe: ${raw.slice(0, 300)}`;
        } else {
            message = `Não foi possível enviar o código. Detalhe: ${raw.slice(0, 300)}`;
        }
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}