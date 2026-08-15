import databases from "../databases";

export interface PublicSaleDTO { id: string; description: string; createdAt: string }
export async function getRecentPublicSales(limit = 3): Promise<PublicSaleDTO[]> {
    const safeLimit = Math.max(0, Math.min(3, Math.trunc(limit)));
    const sales = await databases.extracts.find({ origin: "sales", action: "add" }, { description: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(safeLimit).lean();
    return sales.map((sale) => ({ id: String(sale._id), description: sale.description?.trim() || "Venda confirmada", createdAt: ((sale as typeof sale & { createdAt?: Date }).createdAt || new Date(0)).toISOString() }));
}

export async function getUserPendingCount(discordId: string): Promise<number> {
    const query = { userId: discordId, status: "opened", step: "waiting-payment" };
    const [buys, renewals] = await Promise.all([databases.cartsBuy.countDocuments(query), databases.cartsRenew.countDocuments(query)]);
    return buys + renewals;
}
