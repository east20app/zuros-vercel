import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { authOptions } from "./auth";

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
    return user;
}
