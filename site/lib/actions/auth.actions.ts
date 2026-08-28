"use server";

import axios from "axios";
import databases from "@root/src/databases";
import * as authClient from "@root/src/functions/zuros-auth-client";
import { requireSessionUser } from "./context";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function message(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error ? error.message : "Não foi possível configurar o ZUROS Auth.";
}

async function requireOwnedLicense(localId: string) {
  const ownerId = await requireSessionUser();
  const license = await databases.authLicenses.findOne({ _id: localId, ownerId, status: "active" });
  if (!license?.externalLicenseId) throw new Error("Licença ativa do ZUROS Auth não encontrada.");
  return { license, ownerId, externalLicenseId: license.externalLicenseId };
}

async function withLicense<T>(localId: string, fn: (ctx: { license: Awaited<ReturnType<typeof requireOwnedLicense>>["license"]; ownerId: string; externalLicenseId: string }) => Promise<T>): Promise<Result<T>> {
  try {
    const ctx = await requireOwnedLicense(localId);
    return { ok: true, data: await fn(ctx) };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// ─── Setup Actions ─────────────────────────────────────────────────────

export async function discoverPurchasedAuth(
  localId: string,
  input: { clientId: string; botToken: string }
): Promise<Result<{ bot: { bot_id: string; bot_name: string; bot_avatar?: string | null }; destinations: Array<{ guild_id: string; guild_name: string; guild_icon?: string | null }> }>> {
  console.log("[AUTH-DISCOVER] called with localId:", localId);
  try {
    const result = await withLicense(localId, async ({ license, ownerId, externalLicenseId }) => {
      if (license.setupCompletedAt && license.authId) throw new Error("Este ZUROS Auth já está configurado.");
      console.log("[AUTH-DISCOVER] calling authClient with externalLicenseId:", externalLicenseId, "ownerId:", ownerId);
      return authClient.discoverAuthBot(externalLicenseId, ownerId, input.clientId.trim(), input.botToken.trim());
    });
    console.log("[AUTH-DISCOVER] result:", JSON.stringify(result));
    return result;
  } catch (e) {
    console.error("[AUTH-DISCOVER] uncaught error:", e);
    return { ok: false, error: message(e) };
  }
}

export async function createPurchasedAuth(
  localId: string,
  input: { name: string; clientId: string; clientSecret: string; botToken: string; guildId: string }
): Promise<Result<{ id: string; name: string; botName: string; callbackUrl: string; integrationKey: string | null }>> {
  console.log("[AUTH-CREATE] called with localId:", localId, "guildId:", input.guildId);
  try {
    const result = await withLicense(localId, async ({ license, ownerId, externalLicenseId }) => {
      if (license.setupCompletedAt && license.authId) throw new Error("Este ZUROS Auth já está configurado.");
      console.log("[AUTH-CREATE] calling authClient.createLicensedAuth with externalLicenseId:", externalLicenseId);
      const created = await authClient.createLicensedAuth(externalLicenseId, {
        ownerDiscordId: ownerId,
        name: input.name.trim(),
        mainBotId: input.clientId.trim(),
        guildId: input.guildId,
        oauthClientId: input.clientId.trim(),
        oauthClientSecret: input.clientSecret.trim(),
        oauthBotToken: input.botToken.trim(),
      });
      await databases.authLicenses.updateOne(
        { _id: license._id, ownerId },
        { $set: { authId: created.id, setupCompletedAt: new Date(), dashboardUrl: `/dashboard/auth/${license._id}` } }
      );
      return {
        id: created.id,
        name: created.name,
        botName: created.oauth_bot_name || created.name,
        callbackUrl: created.callback_url,
        integrationKey: created.bot_credential || null,
      };
    });
    console.log("[AUTH-CREATE] result:", JSON.stringify(result));
    return result;
  } catch (e) {
    console.error("[AUTH-CREATE] uncaught error:", e);
    return { ok: false, error: message(e) };
  }
}

export async function getPurchasedAuth(localId: string): Promise<Record<string, unknown> | null> {
  const ownerId = await requireSessionUser();
  const license = await databases.authLicenses.findOne({ _id: localId, ownerId, status: "active" });
  if (!license?.externalLicenseId || !license.authId) return null;
  return authClient.getLicensedAuth(license.externalLicenseId, ownerId);
}

// ─── Dashboard Tab Actions ─────────────────────────────────────────────

export async function fetchAuthStats(localId: string, days = 7) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthStats(externalLicenseId, ownerId, days)
  );
}

export async function fetchAuthMessage(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthMessage(externalLicenseId, ownerId)
  );
}

export async function saveAuthMessage(
  localId: string,
  body: { content?: string | null; embed?: Record<string, unknown> | null; button_label?: string; button_emoji?: string | null; button_style?: string; enabled?: boolean }
) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.putAuthMessage(externalLicenseId, ownerId, body)
  );
}

export async function fetchAuthDestinations(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthDestinations(externalLicenseId, ownerId)
  );
}

export async function fetchAuthVerifiedUsers(
  localId: string,
  params: { page?: number; page_size?: number; q?: string; status?: string } = {}
) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthVerifiedUsers(externalLicenseId, ownerId, params)
  );
}

export async function fetchAuthRecovery(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthRecovery(externalLicenseId, ownerId)
  );
}

export async function startAuthRecoveryTask(localId: string, targetGuildId: string, limit?: number | null) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.startAuthRecovery(externalLicenseId, ownerId, targetGuildId, limit)
  );
}

export async function cancelAuthRecoveryTask(localId: string, taskId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.cancelAuthRecovery(externalLicenseId, ownerId, taskId)
  );
}

export async function fetchAuthGifts(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthGifts(externalLicenseId, ownerId)
  );
}

export async function createAuthGiftAction(
  localId: string,
  body: { name: string; role_id: string; members_count: number }
) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.createAuthGift(externalLicenseId, ownerId, body)
  );
}

export async function redeemAuthGiftAction(localId: string, giftId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.redeemAuthGift(externalLicenseId, ownerId, giftId)
  );
}

export async function deleteAuthGiftAction(localId: string, giftId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.deleteAuthGift(externalLicenseId, ownerId, giftId)
  );
}

export async function fetchAuthTeam(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthTeam(externalLicenseId, ownerId)
  );
}

export async function inviteAuthTeamAction(localId: string, discordUserId: string, role = "viewer") {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.inviteAuthTeam(externalLicenseId, ownerId, discordUserId, role)
  );
}

export async function updateAuthTeamMemberAction(localId: string, memberId: string, role: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.updateAuthTeamMember(externalLicenseId, ownerId, memberId, role)
  );
}

export async function removeAuthTeamMemberAction(localId: string, memberId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.removeAuthTeamMember(externalLicenseId, ownerId, memberId)
  );
}

export async function saveAuthSettings(
  localId: string,
  body: { name?: string; guild_id?: string; verified_role_id?: string; autorole_id?: string; log_channel_id?: string; enabled?: boolean }
) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.updateAuthSettings(externalLicenseId, ownerId, body)
  );
}

export async function saveAuthDefinitions(localId: string, defs: Record<string, boolean>) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.updateAuthDefinitions(externalLicenseId, ownerId, defs)
  );
}

export async function rotateAuthKey(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.rotateAuthCredential(externalLicenseId, ownerId)
  );
}

export async function fetchAuthLogs(
  localId: string,
  params: { page?: number; page_size?: number; category?: string; result?: string; user?: string } = {}
) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthLogs(externalLicenseId, ownerId, params)
  );
}

export async function fetchAuthTasks(localId: string) {
  return withLicense(localId, ({ externalLicenseId, ownerId }) =>
    authClient.getAuthTasks(externalLicenseId, ownerId)
  );
}
