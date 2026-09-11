import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import databases from "@root/src/databases";
import { renderEmail } from "@root/src/lib/email-layout";

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
            const rendered = renderEmail({ eyebrow: "ACESSO SEGURO", heroTitle: "Seu código de acesso", heroSubtitle: "Use este código para entrar no dashboard. Ele expira em 10 minutos e só pode ser usado uma vez.", fields: [{ label: "Código", value: code }], primaryCta: { label: "Abrir Dashboard", href: "/dashboard" }, campaign: "login_code", footerNote: "Não solicitou este código? Ignore esta mensagem com segurança. Nunca compartilhe seu código." });
            await transporter.sendMail({
                from: smtp.from,
                to: email,
                subject: "Seu código de acesso à ZUROS",
                text: rendered.text,
                html: rendered.html,
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
