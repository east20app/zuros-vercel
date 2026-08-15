"use server";

import axios from "axios";
import { Types } from "mongoose";
import databases from "@root/src/databases";
import { decryptOAuthToken, encryptOAuthToken } from "@root/src/functions/oauth-crypto";
import { canAccessAdmin, requireSessionUser, type ActionResult } from "./context";

async function requireAdmin() {
    const discordId = await requireSessionUser();
    if (!(await canAccessAdmin(discordId))) throw new Error("Acesso administrativo necessário.");
}

async function loginBotToken() {
    await requireAdmin();
    const token = String(process.env.BOT_TOKEN || "");
    if (!token) throw new Error("BOT_TOKEN do bot de login não configurado.");
    const me = await axios.get("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bot ${token}` }, timeout: 15_000 });
    if (String(me.data?.id || "") !== String(process.env.DISCORD_CLIENT_ID || "")) throw new Error("BOT_TOKEN não pertence ao bot configurado no login Discord.");
    return token;
}

export async function listSiteUsers() {
    await requireAdmin();
    const [users, purchases, renewals, applications, settings] = await Promise.all([
        databases.siteUsers.find({}, { accessTokenEncrypted: 0, refreshTokenEncrypted: 0 }).sort({ lastLoginAt: -1 }).lean(),
        databases.cartsBuy.find({}, { userId: 1 }).lean(),
        databases.cartsRenew.find({}, { userId: 1 }).lean(),
        databases.applications.find({}, { ownerId: 1 }).lean(),
        databases.userSettings.find({}, { userId_discord: 1 }).lean(),
    ]);
    const result = new Map(users.map((user) => [user.discordId, {
        id: user.discordId, name: user.name, username: user.username || "", globalName: user.globalName || "", discriminator: user.discriminator || "",
        email: user.email || "", image: user.image || "", avatarHash: user.avatarHash || "", bannerHash: user.bannerHash || "", accentColor: user.accentColor || 0,
        locale: user.locale || "", emailVerified: !!user.emailVerified, mfaEnabled: !!user.mfaEnabled, premiumType: user.premiumType || 0,
        flags: user.flags || 0, publicFlags: user.publicFlags || 0, guilds: user.guilds || [], authorized: user.authorizedGuildJoin,
        tokenExpiresAt: user.tokenExpiresAt?.toISOString() || "", firstLoginAt: user.firstLoginAt?.toISOString() || user.lastLoginAt.toISOString(),
        lastLoginAt: user.lastLoginAt.toISOString(), loginCount: user.loginCount || 1,
    }]));
    const known = [
        ...purchases.map((item) => ({ id: item.userId, seenAt: new Types.ObjectId(String(item._id)).getTimestamp() })),
        ...renewals.map((item) => ({ id: item.userId, seenAt: new Types.ObjectId(String(item._id)).getTimestamp() })),
        ...applications.map((item) => ({ id: item.ownerId, seenAt: new Types.ObjectId(String(item._id)).getTimestamp() })),
        ...settings.map((item) => ({ id: item.userId_discord, seenAt: new Types.ObjectId(String(item._id)).getTimestamp() })),
    ];
    for (const item of known) {
        const id = String(item.id || "");
        if (!/^\d{17,20}$/.test(id) || result.has(id)) continue;
        result.set(id, {
            id, name: "Usuário Discord", username: id, globalName: "", discriminator: "", email: "", image: "", avatarHash: "", bannerHash: "", accentColor: 0,
            locale: "", emailVerified: false, mfaEnabled: false, premiumType: 0, flags: 0, publicFlags: 0, guilds: [], authorized: false,
            tokenExpiresAt: "", firstLoginAt: item.seenAt.toISOString(), lastLoginAt: item.seenAt.toISOString(), loginCount: 0,
        });
    }
    return { users: Array.from(result.values()).sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt)), applications: [{ id: "login", name: "Bot de login", botId: String(process.env.DISCORD_CLIENT_ID || "") }] };
}

export async function listLoginBotServers(): Promise<ActionResult<Array<{ id: string; name: string }>>> {
    try {
        const token = await loginBotToken();
        const response = await axios.get("https://discord.com/api/v10/users/@me/guilds", { headers: { Authorization: `Bot ${token}` }, timeout: 15_000 });
        const guilds = Array.isArray(response.data) ? response.data : [];
        return { ok: true, data: guilds.map((guild: { id: string; name: string }) => ({ id: String(guild.id), name: String(guild.name) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Não foi possível listar os servidores." }; }
}

export async function listBotServers(_appId: string) {
    void _appId;
    return listLoginBotServers();
}

async function userAccessToken(userId: string) {
    const user = await databases.siteUsers.findOne({ discordId: userId }).select("+accessTokenEncrypted +refreshTokenEncrypted tokenExpiresAt authorizedGuildJoin");
    if (!user?.authorizedGuildJoin || !user.accessTokenEncrypted) throw new Error("Este usuário precisa sair e entrar novamente para autorizar a entrada em servidores.");
    if (!user.tokenExpiresAt || user.tokenExpiresAt.getTime() > Date.now() + 60_000) return decryptOAuthToken(user.accessTokenEncrypted);
    if (!user.refreshTokenEncrypted) throw new Error("A autorização expirou. Peça para o usuário entrar novamente.");
    const body = new URLSearchParams({ client_id: String(process.env.DISCORD_CLIENT_ID || ""), client_secret: String(process.env.DISCORD_CLIENT_SECRET || ""), grant_type: "refresh_token", refresh_token: decryptOAuthToken(user.refreshTokenEncrypted) });
    const refreshed = await axios.post("https://discord.com/api/v10/oauth2/token", body, { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15_000 });
    user.accessTokenEncrypted = encryptOAuthToken(refreshed.data.access_token);
    if (refreshed.data.refresh_token) user.refreshTokenEncrypted = encryptOAuthToken(refreshed.data.refresh_token);
    user.tokenExpiresAt = new Date(Date.now() + Number(refreshed.data.expires_in || 3600) * 1000);
    await user.save(); return String(refreshed.data.access_token);
}

export async function addSiteUserToServer(input: { userId: string; guildId: string; appId?: string }): Promise<ActionResult<null>> {
    try {
        if (!/^\d{17,20}$/.test(input.userId) || !/^\d{17,20}$/.test(input.guildId)) throw new Error("Usuário ou servidor inválido.");
        const [token, accessToken] = await Promise.all([loginBotToken(), userAccessToken(input.userId)]);
        await axios.put(`https://discord.com/api/v10/guilds/${input.guildId}/members/${input.userId}`, { access_token: accessToken }, { headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, timeout: 15_000 });
        return { ok: true, data: null };
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) return { ok: false, error: "O bot de login precisa da permissão Gerenciar Servidor." };
        if (axios.isAxiosError(error) && error.response?.status === 401) return { ok: false, error: "A autorização do usuário ou o token do bot expirou." };
        return { ok: false, error: error instanceof Error ? error.message : "Não foi possível adicionar o usuário." };
    }
}
