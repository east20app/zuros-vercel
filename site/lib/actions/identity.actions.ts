"use server";
import databases from "@root/src/databases";
import { requireSessionUser } from "./context";
export async function saveRequiredDiscordId(value: string) { const userId = await requireSessionUser(); const discordId = value.trim(); if (!/^\d{15,25}$/.test(discordId)) throw new Error("Informe um ID de usuário Discord válido, com apenas números."); if (userId.startsWith("email:")) { await databases.siteUsers.updateOne({ discordId: userId }, { $set: { linkedDiscordId: discordId, discordIdentityCompleted: true } }); return { ok: true }; } throw new Error("Esta conta já está vinculada ao Discord."); }
export async function getRequiredDiscordIdentity() { const userId = await requireSessionUser(); const user = await databases.siteUsers.findOne({ discordId: userId }, { linkedDiscordId: 1, discordIdentityCompleted: 1 }).lean(); return { required: userId.startsWith("email:") && !user?.discordIdentityCompleted, linkedDiscordId: user?.linkedDiscordId || "" }; }
