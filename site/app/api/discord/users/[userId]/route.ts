import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDiscordProfile } from "@/lib/discord-profile";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    context: { params: Promise<{ userId: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
        return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    const { userId } = await context.params;
    const profile = await getDiscordProfile(userId);
    if (!profile) {
        return Response.json({ error: "Perfil do Discord não encontrado." }, { status: 404 });
    }
    return Response.json(profile, {
        headers: { "Cache-Control": "private, max-age=300" },
    });
}
