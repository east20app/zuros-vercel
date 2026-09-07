import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import databases from "@root/src/databases";

export const runtime = "nodejs";

const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

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
        let user = await users.findOne({ email }).select("+emailLoginCodeRequestedAt");
        const now = new Date();
        if (user?.emailLoginCodeRequestedAt && now.getTime() - user.emailLoginCodeRequestedAt.getTime() < REQUEST_COOLDOWN_MS) {
            return NextResponse.json({ ok: true, message: "Se o e-mail estiver cadastrado, um código será enviado em instantes." });
        }

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
            { $set: { emailLoginCodeHash: codeHash(email, code), emailLoginCodeExpiresAt: new Date(now.getTime() + CODE_TTL_MS), emailLoginCodeRequestedAt: now, emailLoginCodeAttempts: 0, email }, $unset: { emailVerified: "" } },
        );

        const transporter = nodemailer.createTransport(smtp);
        try {
            await transporter.sendMail({
                from: smtp.from,
                to: email,
                subject: "Seu código de acesso à ZUROS",
                text: `Seu código de acesso é ${code}. Ele expira em 10 minutos e só pode ser usado uma vez.`,
                html: `<p>Seu código de acesso à <strong>ZUROS</strong> é:</p><p style="font-size:28px;letter-spacing:8px"><strong>${code}</strong></p><p>Ele expira em 10 minutos e só pode ser usado uma vez.</p>`,
            });
        } catch (error) {
            await users.updateOne({ _id: user._id }, { $unset: { emailLoginCodeHash: "", emailLoginCodeExpiresAt: "", emailLoginCodeRequestedAt: "", emailLoginCodeAttempts: "" } });
            throw error;
        }

        return NextResponse.json({ ok: true, message: "Se o e-mail estiver cadastrado, um código foi enviado." });
    } catch (error) {
        console.error("[auth-email] Falha ao enviar código:", error instanceof Error ? error.message : "erro desconhecido");
        const message = error instanceof Error && /não está configurada|inválida/i.test(error.message)
            ? "O envio de e-mail ainda não está configurado corretamente."
            : error instanceof Error && /timeout|timed out|etimedout|econnreset|econnrefused/i.test(error.message)
                ? "O servidor de e-mail demorou para responder. Verifique SMTP 587/STARTTLS no Hostinger."
            : "Não foi possível enviar o código agora. Tente novamente mais tarde.";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
