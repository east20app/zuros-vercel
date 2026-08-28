"use server";
import databases from "@root/src/databases";
import { requireSessionUser } from "./context";
import { getBotDocument } from "@/lib/drox-bot-config";

export type BotActivityNotification = { id: string; type: "ticket_opened" | "cart_opened"; appId: string; botName: string; userId: string; createdAt: number; title: string; body: string; href: string };
const rec = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function getBotActivityNotifications(): Promise<BotActivityNotification[]> {
    const ownerId = await requireSessionUser();
    const apps = await databases.applications.find({ ownerId, status: "active", botId: { $exists: true, $ne: null } }, { botId: 1, name: 1 }).lean().catch(() => []);
    const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400;
    const groups = await Promise.all(apps.map(async (application) => {
        const appId = String(application._id); const botId = String(application.botId || ""); const botName = String(application.name || "Bot ZUROS");
        if (!/^\d{15,25}$/.test(botId)) return [];
        const [tickets, store] = await Promise.all([getBotDocument(botId, "tickets_data").catch(() => null), getBotDocument(botId, "loja_data").catch(() => null)]);
        const output: BotActivityNotification[] = [];
        const panels = rec(tickets?.panels);
        for (const users of Object.values(panels)) for (const [userId, entries] of Object.entries(rec(users))) if (Array.isArray(entries)) for (const raw of entries) {
            const ticket = rec(raw); const createdAt = Number(ticket.created_at || 0); if (!Number.isFinite(createdAt) || createdAt < cutoff) continue;
            const ticketId = String(ticket.ticket_id || ticket.channel_id || createdAt);
            output.push({ id: `${botId}:ticket:${ticketId}`, type: "ticket_opened", appId, botName, userId, createdAt, title: "Novo ticket aberto", body: `O usuário ${userId} abriu um ticket no ${botName}.`, href: `/dashboard/${botId}/config/tickets` });
        }
        for (const [cartId, raw] of Object.entries(rec(store?.carts))) {
            const cart = rec(raw); const createdAt = Number(cart.created_at || 0); if (!Number.isFinite(createdAt) || createdAt < cutoff) continue;
            const userId = String(cart.user_id || "Usuário"); const amount = Number(cart.total_price || 0); const value = Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "valor pendente";
            output.push({ id: `${botId}:cart:${cartId}`, type: "cart_opened", appId, botName, userId, createdAt, title: "Novo carrinho aberto", body: `O usuário ${userId} abriu um carrinho de ${value} no ${botName}.`, href: `/dashboard/${botId}/vendas/carrinhos-abertos` });
        }
        return output;
    }));
    return groups.flat().sort((a,b)=>b.createdAt-a.createdAt).slice(0,100);
}