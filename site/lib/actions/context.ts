import databases from "@root/src/databases";
import connectDatabase from "@root/src/databases/connection";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export class ActionError extends Error {}
export const PRIMARY_ADMIN_STORE_ID = "6a6f9c98ffb784b910182a6f";

async function ensureDatabaseConnection(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            await connectDatabase();
            return;
        } catch {
            if (attempt === 1) throw new ActionError("Banco de dados temporariamente indisponível. Tente novamente em alguns segundos.");
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
}

export async function getSessionUser(): Promise<{ discordId: string } | null> {
    const { authOptions } = await import("@/lib/auth");
    const { getServerSession } = await import("next-auth");
    // Tentativas com backoff curto: o contexto de requisição pode ainda não
    // estar pronto na primeira chamada de uma Server Action durante navegação,
    // o que gerava "Não autenticado" e derrubava o usuário para o login.
    const delays = [50, 150];
    for (let attempt = 0; attempt < 3; attempt++) {
        const session = await getServerSession(authOptions);
        if (session?.user?.discordId) return { discordId: session.user.discordId };
        if (attempt < delays.length) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
    return null;
}

export async function requireSessionUser(): Promise<string> {
    const user = await getSessionUser();
    if (!user) {
        throw new ActionError("Não autenticado.");
    }
    await ensureDatabaseConnection();
    return user.discordId;
}

export async function getStoresForUser(discordId: string) {
    await ensureDatabaseConnection();
    if (process.env.OWNER_ID && discordId === process.env.OWNER_ID) {
        return databases.stores.find({ _id: PRIMARY_ADMIN_STORE_ID });
    }
    const settings = await databases.userSettings.findOne({ userId_discord: discordId }, { userId_campos: 1 });
    return databases.stores.find({
        _id: PRIMARY_ADMIN_STORE_ID,
        $or: [
            { ownerId_campos: settings?.userId_campos || "__none__" },
            { ownerId_campos: `discord:${discordId}` },
            { permissions: { $elemMatch: { userId: discordId, permissions: "admin" } } },
        ],
    });
}

export async function canAccessAdmin(discordId: string): Promise<boolean> {
    await ensureDatabaseConnection();
    if (process.env.OWNER_ID && discordId === process.env.OWNER_ID) return true;
    const settings = await databases.userSettings.findOne({ userId_discord: discordId }, { userId_campos: 1 });
    const store = await databases.stores.findOne({
        _id: PRIMARY_ADMIN_STORE_ID,
        $or: [
            { ownerId_campos: settings?.userId_campos || "__none__" },
            { ownerId_campos: `discord:${discordId}` },
            { permissions: { $elemMatch: { userId: discordId, permissions: "admin" } } },
        ],
    }, { _id: 1 });
    return !!store;
}

export async function getOwnerDiscordId(storeId: string): Promise<string | null> {
    await ensureDatabaseConnection();
    if (storeId !== PRIMARY_ADMIN_STORE_ID) return null;
    const store = await databases.stores.findById(storeId, { ownerId_campos: 1 });
    if (!store?.ownerId_campos) return null;
    if (store.ownerId_campos.startsWith("discord:")) return store.ownerId_campos.slice(8);
    const ownerSettings = await databases.userSettings.findOne(
        { userId_campos: store.ownerId_campos },
        { userId_discord: 1 }
    );
    return ownerSettings?.userId_discord || null;
}

export async function getStoreSdk(storeId: string) {
    const ownerDiscordId = await getOwnerDiscordId(storeId);
    if (!ownerDiscordId) return null;
    const sdk = await sdkWrapper.getInstance(ownerDiscordId).catch(() => null);
    if (!sdk || !sdk.isValid) return null;
    return sdk.instance;
}
