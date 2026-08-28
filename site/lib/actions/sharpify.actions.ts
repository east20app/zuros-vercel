"use server";

import crypto from "crypto";
import databases from "@root/src/databases";
import sharpifyWrapper from "@root/src/functions/sharpify_wrapper";
import { ActionError, canAccessAdmin, requireSessionUser } from "./context";

async function context() {
    const discordId = await requireSessionUser();
    if (!await canAccessAdmin(discordId)) throw new ActionError("Acesso restrito ao administrador da plataforma.");
    const settings = await databases.userSettings.findOne({ userId_discord: discordId });
    const credentials = settings?.sharpify_credentials;
    if (!credentials?.client_id || !credentials.client_secret) throw new ActionError("Configure a Sharpify em Admin → Configurações.");
    return { discordId, credentials: { client_id: credentials.client_id, client_secret: credentials.client_secret } };
}

export async function getSharpifyDashboard() {
    const { discordId, credentials } = await context();
    const [withdrawData, events] = await Promise.all([
        sharpifyWrapper.getWithdrawData(credentials),
        databases.sharpifyEvents.find({ ownerDiscordId: discordId }).sort({ occurredAt: -1 }).limit(50).lean(),
    ]);
    return {
        withdrawData,
        events: events.map((event) => ({ id: String(event._id), webhookId: event.webhookId, name: event.name, context: event.context, contextId: event.contextId, occurredAt: event.occurredAt.toISOString() })),
    };
}

export async function sharpifyGetPayment(paymentLinkId: string) {
    const { credentials } = await context();
    const id = paymentLinkId.trim();
    if (!id) throw new ActionError("Informe o ID do pagamento.");
    const result = await sharpifyWrapper.getPayment(credentials, id);
    if (!result) throw new ActionError("Pagamento não encontrado ou consulta recusada.");
    return result;
}

export async function sharpifyRefundPayment(paymentLinkId: string, amount: number) {
    const { credentials } = await context();
    if (!paymentLinkId.trim() || !Number.isFinite(amount) || amount <= 0) throw new ActionError("Informe o pagamento e um valor válido.");
    const result = await sharpifyWrapper.refundPayment(credentials, paymentLinkId.trim(), amount);
    if (!result) throw new ActionError("A Sharpify não aceitou a solicitação de reembolso.");
    return result;
}

export async function sharpifyRequestWithdraw(input: { amount: number; fullName: string; pixKey: string; pixType: string; idempotencyKey?: string }) {
    const { credentials } = await context();
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.fullName.trim() || !input.pixKey.trim()) throw new ActionError("Preencha todos os dados do saque.");
    const allowed = ["EMAIL", "CPF", "CNPJ", "PHONE_NUMBER", "RANDOM_KEY"];
    if (!allowed.includes(input.pixType)) throw new ActionError("Tipo de chave PIX inválido.");
    const key = input.idempotencyKey?.trim() || crypto.randomUUID();
    const result = await sharpifyWrapper.requestWithdraw(credentials, { amount: input.amount, payoutData: { fullName: input.fullName.trim(), pixKey: input.pixKey.trim(), pixType: input.pixType } }, key);
    if (!result) throw new ActionError("A Sharpify não aceitou a solicitação de saque.");
    return { ...result, idempotencyKey: key };
}

export async function sharpifyGetWithdraw(withdrawId: string) {
    const { credentials } = await context();
    if (!withdrawId.trim()) throw new ActionError("Informe o ID do saque.");
    const result = await sharpifyWrapper.getWithdraw(credentials, withdrawId.trim());
    if (!result) throw new ActionError("Saque não encontrado ou consulta recusada.");
    return result;
}