import "server-only";

import databases from "@root/src/databases";

export interface DiscordProfile {
    id: string;
    name: string;
    username: string;
    avatarUrl: string;
    bot: boolean;
}

type DiscordUser = {
    id?: string;
    username?: string;
    global_name?: string | null;
    discriminator?: string;
    avatar?: string | null;
    bot?: boolean;
};

const CACHE_TTL_MS = 10 * 60_000;
const profileCache = new Map<string, { value: DiscordProfile; expiresAt: number }>();

function defaultAvatar(id: string): string {
    let index = BigInt(0);
    try {
        index = (BigInt(id) >> BigInt(22)) % BigInt(6);
    } catch {
        index = BigInt(0);
    }
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function avatarUrl(id: string, hash?: string | null): string {
    if (!hash) return defaultAvatar(id);
    const extension = hash.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${extension}?size=128`;
}

function fromDiscord(user: DiscordUser): DiscordProfile | null {
    const id = String(user.id || "");
    if (!/^\d{17,20}$/.test(id)) return null;
    const username = String(user.username || id);
    return {
        id,
        name: String(user.global_name || username),
        username,
        avatarUrl: avatarUrl(id, user.avatar),
        bot: Boolean(user.bot),
    };
}

export async function getDiscordProfile(userId: string): Promise<DiscordProfile | null> {
    const id = userId.trim();
    if (!/^\d{17,20}$/.test(id)) return null;
    const cached = profileCache.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const token = process.env.BOT_TOKEN?.trim();
    if (token) {
        const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
            headers: { Authorization: `Bot ${token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(8_000),
        }).catch(() => null);
        if (response?.ok) {
            const value = fromDiscord((await response.json()) as DiscordUser);
            if (value) {
                profileCache.set(id, { value, expiresAt: Date.now() + CACHE_TTL_MS });
                return value;
            }
        }
    }

    const saved = await databases.siteUsers.findOne(
        { $or: [{ discordId: id }, { linkedDiscordId: id }] },
        { discordId: 1, linkedDiscordId: 1, name: 1, username: 1, globalName: 1, image: 1, avatarHash: 1 }
    ).lean();
    if (!saved) return null;
    const value: DiscordProfile = {
        id,
        name: saved.globalName || saved.name || saved.username || id,
        username: saved.username || saved.name || id,
        avatarUrl: saved.image || avatarUrl(id, saved.avatarHash),
        bot: false,
    };
    profileCache.set(id, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
}
