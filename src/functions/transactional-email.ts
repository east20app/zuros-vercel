import nodemailer from "nodemailer";
import databases from "../databases";
import { esc, renderEmail } from "../lib/email-layout";

type LoginContext = { ip: string; city: string; region: string; country: string };
export type CartNotification = { userId: string; cartId: string; type: "purchase" | "renewal"; productName: string; plan: string; amount: number; expiresAt?: Date | string | null; applicationName?: string };

function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`A variável ${name} não está configurada.`); return value; }
function money(value: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function date(value?: Date | string | null): string { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }
function transport() { const port = Number(process.env.EMAIL_SERVER_PORT || 587); return { host: required("EMAIL_SERVER_HOST"), port, secure: process.env.EMAIL_SERVER_SECURE === "true", auth: { user: required("EMAIL_SERVER_USER"), pass: required("EMAIL_SERVER_PASSWORD") }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000, requireTLS: process.env.EMAIL_SERVER_SECURE !== "true" }; }
export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; html: string }) { if (!input.to) return; const transporter = nodemailer.createTransport(transport()); await transporter.sendMail({ from: required("EMAIL_FROM"), replyTo: required("EMAIL_FROM"), to: input.to, subject: input.subject, text: input.text, html: input.html, headers: { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" } }); }
async function userEmail(userId: string): Promise<{ email: string; name: string } | null> { const user = await databases.siteUsers.findOne({ discordId: userId }, { email: 1, name: 1 }).lean(); return user?.email ? { email: user.email, name: user.name || "cliente" } : null; }

export async function sendLoginAlert(input: { userId: string; method: "Discord" | "e-mail"; context: LoginContext }) {
    const user = await userEmail(input.userId); if (!user) return;
    const place = [input.context.city, input.context.region, input.context.country].filter(Boolean).join(", ") || "localização não informada";
    const when = date(new Date());
    const subject = "Novo acesso à sua conta ZUROS";
    const rendered = renderEmail({ preheader: "Um novo acesso foi detectado na sua conta ZUROS.", eyebrow: "SEGURANÇA", heroTitle: "Novo acesso detectado", heroSubtitle: "Confirme se foi você quem entrou na sua conta.", greeting: `Olá, ${user.name}.`, intro: "Detectamos um novo acesso à sua conta ZUROS.", fields: [{ label: "Método", value: input.method }, { label: "Data", value: when }, { label: "IP", value: input.context.ip }, { label: "Local aproximado", value: place }], primaryCta: { label: "Revisar Segurança", href: "/dashboard/seguranca" }, secondaryCta: { label: "Falar com Suporte", href: "/suporte" }, campaign: "login_alert", footerNote: "Se não foi você, altere sua senha imediatamente e entre em contato com o suporte." });
    await sendTransactionalEmail({ to: user.email, subject, ...rendered });
}

export async function sendCartOpenedAlert(input: CartNotification) {
    const user = await userEmail(input.userId); if (!user) return;
    const kind = input.type === "renewal" ? "renovação" : "pedido";
    const subject = `Seu ${kind} foi aberto na ZUROS`;
    const rendered = renderEmail({ preheader: `Seu ${kind} está pronto para pagamento.`, eyebrow: kind === "renovação" ? "RENOVAÇÃO" : "NOVO PEDIDO", heroTitle: kind === "renovação" ? "Sua renovação está pronta" : "Pedido aberto", heroSubtitle: "Confira os dados e continue quando estiver pronto.", greeting: `Olá, ${user.name}.`, intro: `Seu ${kind} foi aberto.`, fields: [{ label: "Produto", value: input.productName }, { label: "Plano", value: input.plan }, { label: "Valor", value: money(input.amount) }, { label: "Expira em", value: date(input.expiresAt) }], primaryCta: { label: "Abrir Pagamento", href: `/dashboard/store/cart/${encodeURIComponent(input.cartId)}` }, campaign: "cart_opened", footerNote: "O carrinho permanece sujeito ao prazo informado acima." });
    await sendTransactionalEmail({ to: user.email, subject, ...rendered });
}

export async function sendPaymentConfirmedAlert(input: CartNotification) {
    const user = await userEmail(input.userId); if (!user) return;
    const kind = input.type === "renewal" ? "renovação" : "pedido";
    const subject = `Pagamento aprovado: ${input.productName}`;
    const fields = [{ label: "Produto", value: input.productName }, { label: "Plano", value: input.plan }, { label: "Valor", value: money(input.amount) }, ...(input.applicationName ? [{ label: "Aplicação", value: input.applicationName }] : []), ...(input.expiresAt ? [{ label: "Válido até", value: date(input.expiresAt) }] : [])];
    const rendered = renderEmail({ preheader: `Pagamento confirmado para ${input.productName}.`, eyebrow: "PAGAMENTO APROVADO", heroTitle: "Pagamento aprovado", heroSubtitle: "Sua aplicação está pronta.", greeting: `Olá, ${user.name}.`, intro: `Seu ${kind} foi confirmado pelo sistema.`, fields, primaryCta: { label: "Acessar Dashboard", href: "/dashboard" }, secondaryCta: input.applicationName ? { label: "Ver Aplicação", href: `/dashboard/apps/${encodeURIComponent(input.applicationName)}` } : undefined, campaign: "payment_confirmed" });
    await sendTransactionalEmail({ to: user.email, subject, ...rendered });
}

export async function sendRenewalReminder(input: { userId: string; applicationName: string; expiresAt: Date; daysLeft: number }) {
    const user = await userEmail(input.userId); if (!user) return;
    const days = `${input.daysLeft} dia${input.daysLeft === 1 ? "" : "s"}`;
    const subject = `Seu plano vence em ${days}`;
    const rendered = renderEmail({ preheader: `O plano de ${input.applicationName} vence em ${days}.`, eyebrow: "RENOVAÇÃO", heroTitle: `Seu plano vence em ${days}`, heroSubtitle: "Renove agora para evitar interrupção do serviço.", greeting: `Olá, ${user.name}.`, intro: `O plano da aplicação ${input.applicationName} está próximo do vencimento.`, fields: [{ label: "Aplicação", value: input.applicationName }, { label: "Vencimento", value: date(input.expiresAt) }], primaryCta: { label: "Renovar Agora", href: `/dashboard/renovar/${encodeURIComponent(input.applicationName)}` }, campaign: "renewal_reminder", footerNote: "Renove antes do vencimento para evitar interrupção do serviço." });
    await sendTransactionalEmail({ to: user.email, subject, ...rendered });
}

function replaceTemplateTokens(template: string, values: Record<string, string>): string { return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] || ""); }
function htmlToText(html: string): string { return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>(?=.)/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s{2,}/g, " ").trim(); }
export async function sendReleaseUpdateAlert(input: { userId: string; productName: string; version: string; notes: string }) {
    const user = await userEmail(input.userId); if (!user) return;
    const subject = `Nova atualização disponível: ${input.productName} v${input.version}`;
    const raw = input.notes.trim();
    const isTemplate = /<(!doctype\s+html|html\b|table\b|body\b|div\b)/i.test(raw);
    if (isTemplate) {
        const html = replaceTemplateTokens(raw, { CUSTOMER_NAME: esc(user.name), PRODUCT_NAME: esc(input.productName), VERSION: esc(input.version), DATE: esc(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date())) });
        await sendTransactionalEmail({ to: user.email, subject, html, text: htmlToText(html) });
        return;
    }
    const rendered = renderEmail({ preheader: `Nova versão disponível para ${input.productName}.`, eyebrow: "ATUALIZAÇÃO", heroTitle: "Nova versão disponível", heroSubtitle: `${input.productName} · v${input.version}`, greeting: `Olá, ${user.name}.`, intro: "Uma nova versão da sua aplicação foi publicada.", fields: [{ label: "Produto", value: input.productName }, { label: "Versão", value: input.version }], note: raw || "Acesse o painel para ver os detalhes da atualização.", primaryCta: { label: "Ver Atualização", href: `/dashboard/apps/${encodeURIComponent(input.productName)}/releases` }, campaign: "release_update" });
    await sendTransactionalEmail({ to: user.email, subject, ...rendered });
}
export function loginContextFromHeaders(headers: Headers): LoginContext { const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim(); return { ip: forwarded || headers.get("x-real-ip") || "não informado", city: headers.get("x-vercel-ip-city") || "", region: headers.get("x-vercel-ip-country-region") || "", country: headers.get("x-vercel-ip-country") || "" }; }
