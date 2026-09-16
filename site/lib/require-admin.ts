import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { authOptions } from "./auth";
import databases from "@root/src/databases";
import connectDatabase from "@root/src/databases/connection";

async function ensureDatabaseConnection(): Promise<void> {
    const retryDelays = [250, 750];
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
        try {
            await connectDatabase();
            return;
        } catch (error) {
            lastError = error;
            if (attempt < retryDelays.length) {
                await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
            }
        }
    }

    throw lastError;
}

async function resolveSession(): Promise<Session | null> {
    // Tentativas com backoff curto: o contexto de requisição do Next pode não
    // estar pronto no primeiro acesso (comum em Server Actions disparadas
    // durante navegação), o que antes derrubava o usuário para o login por uma
    // falha transitória. O custo é desprezível frente ao custo de re-login.
    const delays = [50, 150];
    for (let attempt = 0; attempt < 3; attempt++) {
        const session = await getServerSession(authOptions);
        if (session?.user?.discordId) return session;
        if (attempt < delays.length) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
    return null;
}

export async function getSessionUser(): Promise<{ discordId: string; name?: string | null; image?: string | null; email?: string | null } | null> {
    const session = await resolveSession();
    if (!session?.user?.discordId) return null;
    return {
        discordId: session.user.discordId,
        name: session.user.name,
        image: session.user.image,
        email: session.user.email,
    };
}

export async function requireUser() {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    // A importação dos models inicia a conexão em segundo plano. Em funções
    // serverless, a primeira pagina podia consultar o Mongo antes desse inicio
    // terminar e derrubar o layout compartilhado de toda a dashboard.
    await ensureDatabaseConnection();
    const security = await databases.siteUsers.findOne({ discordId: user.discordId }, { totpEnabled: 1, mfaChallengeAt: 1, mfaVerifiedAt: 1 }).lean();
    if (security?.totpEnabled && security.mfaChallengeAt && (!security.mfaVerifiedAt || security.mfaVerifiedAt < security.mfaChallengeAt)) redirect("/login/mfa");
    return user;
}
