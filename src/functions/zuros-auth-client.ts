import axios, { type AxiosError } from "axios";

const baseURL = (process.env.ZUROS_AUTH_SERVICE_URL || "https://auth.zuros.site").replace(/\/$/, "");

function headers(idempotencyKey?: string) {
  const key = process.env.PLATFORM_SERVICE_KEY;
  if (!key) throw new Error("Integração com ZUROS Auth não configurada (PLATFORM_SERVICE_KEY ausente).");
  return {
    "x-platform-service-key": key,
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
  } as const;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const axiosErr = error as AxiosError | undefined;
      const status = axiosErr?.response?.status;
      const retryable = !status || status >= 500 || status === 429;
      if (!retryable || attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

// ─── Input/Output Types ────────────────────────────────────────────────

export interface AuthProvisionInput {
  ownerDiscordId: string;
  productId: string;
  purchaseId: string;
  plan: "basic" | "cloud" | "pro";
  expiresAt?: string | null;
  lifetime?: boolean;
  limits?: { servers?: number; verifiedUsers?: number };
  features?: string[];
}

export interface AuthProvisionResult {
  licenseId: string;
  accountId: string;
  plan: string;
  status: string;
  dashboardUrl: string;
  expiresAt?: string | null;
  lifetime?: boolean;
  limits?: { servers: number; verifiedUsers: number };
  features?: string[];
}

export interface AuthLicenseView {
  licenseId: string;
  accountId: string;
  plan: string;
  status: string;
  ownerDiscordId: string;
  dashboardUrl?: string;
  expiresAt?: string | null;
  lifetime?: boolean;
  limits?: { servers: number; verifiedUsers: number };
  features?: string[];
  configured?: boolean;
}

// ─── Platform Contract Routes ──────────────────────────────────────────

export async function provisionAuthLicense(input: AuthProvisionInput): Promise<AuthProvisionResult> {
  const durationDays = input.lifetime
    ? null
    : Math.max(1, Math.ceil(
        (new Date(input.expiresAt || Date.now() + 2592000000).getTime() - Date.now()) / 86400000
      ));

  return withRetry(async () => {
    const { data } = await axios.post(
      `${baseURL}/internal/platform/licenses/provision`,
      {
        ownerDiscordId: input.ownerDiscordId,
        purchaseId: input.purchaseId,
        plan: input.plan,
        durationDays,
        lifetime: !!input.lifetime,
        limits: { servers: input.limits?.servers || 1, verifiedUsers: input.limits?.verifiedUsers || 1000 },
        features: input.features || [],
      },
      { headers: headers(`purchase:${input.purchaseId}`), timeout: 20000 }
    );
    return {
      licenseId: data.licenseId,
      accountId: data.accountId,
      plan: data.plan,
      status: data.status,
      dashboardUrl: data.dashboardUrl || `${baseURL}/dashboard`,
      expiresAt: data.expiresAt,
      lifetime: data.lifetime,
      limits: data.limits,
      features: data.features,
    };
  });
}

export async function getAuthLicense(licenseId: string): Promise<AuthLicenseView> {
  return withRetry(async () => {
    const { data } = await axios.get(
      `${baseURL}/internal/platform/licenses/${licenseId}`,
      { headers: headers(), timeout: 15000 }
    );
    return data as AuthLicenseView;
  });
}

export async function renewAuthLicense(licenseId: string, durationDays: number, operationId: string) {
  return withRetry(async () => {
    const { data } = await axios.post(
      `${baseURL}/internal/platform/licenses/${licenseId}/renew`,
      { durationDays },
      { headers: headers(`renew:${licenseId}:${operationId}`), timeout: 20000 }
    );
    return data as { licenseId: string; status: string; expiresAt?: string | null };
  });
}

export async function suspendAuthLicense(licenseId: string, reason: string) {
  return withRetry(async () => {
    const { data } = await axios.post(
      `${baseURL}/internal/platform/licenses/${licenseId}/suspend`,
      { reason },
      { headers: headers(`suspend:${licenseId}`), timeout: 15000 }
    );
    return data as { licenseId: string; status: string };
  });
}

export async function reactivateAuthLicense(licenseId: string) {
  return withRetry(async () => {
    const { data } = await axios.post(
      `${baseURL}/internal/platform/licenses/${licenseId}/reactivate`,
      {},
      { headers: headers(`reactivate:${licenseId}`), timeout: 15000 }
    );
    return data as { licenseId: string; status: string; expiresAt?: string | null };
  });
}

// ─── Auth Setup (onboarding after purchase) ────────────────────────────

export async function discoverAuthBot(
  licenseId: string,
  ownerDiscordId: string,
  oauthClientId: string,
  oauthBotToken: string
) {
  return withRetry(async () => {
    const { data } = await axios.post(
      `${baseURL}/internal/platform/licenses/${licenseId}/auth/discover`,
      { ownerDiscordId, oauthClientId, oauthBotToken },
      { headers: headers(), timeout: 30000 }
    );
    return data as {
      bot: { bot_id: string; bot_name: string; bot_avatar?: string | null };
      destinations: Array<{ guild_id: string; guild_name: string; guild_icon?: string | null }>;
    };
  });
}

export async function createLicensedAuth(
  licenseId: string,
  input: {
    ownerDiscordId: string;
    name: string;
    mainBotId: string;
    guildId: string;
    oauthClientId: string;
    oauthClientSecret: string;
    oauthBotToken: string;
  }
) {
  return withRetry(async () => {
    const { data } = await axios.post(
      `${baseURL}/internal/platform/licenses/${licenseId}/auth/create`,
      input,
      { headers: headers(`auth-create:${licenseId}`), timeout: 30000 }
    );
    return data as {
      id: string;
      name: string;
      oauth_bot_name?: string | null;
      oauth_client_id: string;
      guild_id: string;
      callback_url: string;
      bot_credential?: string;
      already_configured?: boolean;
    };
  }, 1);
}

export async function getLicensedAuth(licenseId: string, ownerDiscordId: string) {
  const { data } = await axios.get(
    `${baseURL}/internal/platform/licenses/${licenseId}/auth`,
    { headers: headers(), params: { ownerDiscordId }, timeout: 20000 }
  );
  return data as Record<string, unknown>;
}

// ─── Platform Proxy Calls (12 dashboard tabs) ──────────────────────────

async function platformGet<T>(licenseId: string, ownerDiscordId: string, path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await axios.get(
    `${baseURL}/internal/platform/licenses/${licenseId}/auth/${path}`,
    { headers: headers(), params: { ownerDiscordId, ...params }, timeout: 30000 }
  );
  return data as T;
}

async function platformPut<T>(licenseId: string, ownerDiscordId: string, path: string, body: unknown): Promise<T> {
  const { data } = await axios.put(
    `${baseURL}/internal/platform/licenses/${licenseId}/auth/${path}`,
    body,
    { headers: headers(), timeout: 30000 }
  );
  return data as T;
}

async function platformPatch<T>(licenseId: string, ownerDiscordId: string, path: string, body: unknown): Promise<T> {
  const { data } = await axios.patch(
    `${baseURL}/internal/platform/licenses/${licenseId}/auth/${path}`,
    body,
    { headers: headers(), timeout: 30000 }
  );
  return data as T;
}

async function platformPost<T>(licenseId: string, ownerDiscordId: string, path: string, body?: unknown): Promise<T> {
  const { data } = await axios.post(
    `${baseURL}/internal/platform/licenses/${licenseId}/auth/${path}`,
    body || {},
    { headers: headers(), timeout: 30000 }
  );
  return data as T;
}

async function platformDelete<T>(licenseId: string, ownerDiscordId: string, path: string): Promise<T> {
  const { data } = await axios.delete(
    `${baseURL}/internal/platform/licenses/${licenseId}/auth/${path}`,
    { headers: headers(), timeout: 30000 }
  );
  return data as T;
}

export async function getAuthStats(licenseId: string, ownerDiscordId: string, days = 7) {
  return platformGet<{ cards: Record<string, number>; charts: { labels: string[]; verifications: number[]; blocks: number[]; new_users: number[] } }>(licenseId, ownerDiscordId, "stats", { days });
}

export async function getAuthMessage(licenseId: string, ownerDiscordId: string) {
  return platformGet<Record<string, unknown>>(licenseId, ownerDiscordId, "message");
}

export async function putAuthMessage(licenseId: string, ownerDiscordId: string, body: { content?: string | null; embed?: Record<string, unknown> | null; button_label?: string; button_emoji?: string | null; button_style?: string; enabled?: boolean }) {
  return platformPut<Record<string, unknown>>(licenseId, ownerDiscordId, "message", body);
}

export async function getAuthDestinations(licenseId: string, ownerDiscordId: string) {
  return platformGet<{ items: Array<Record<string, unknown>> }>(licenseId, ownerDiscordId, "destinations");
}

export async function getAuthVerifiedUsers(licenseId: string, ownerDiscordId: string, params: { page?: number; page_size?: number; q?: string; status?: string } = {}) {
  return platformGet<{ total: number; page: number; pages: number; items: Array<Record<string, unknown>> }>(licenseId, ownerDiscordId, "verified-users", params);
}

export async function getAuthRecovery(licenseId: string, ownerDiscordId: string) {
  return platformGet<Array<Record<string, unknown>>>(licenseId, ownerDiscordId, "recovery");
}

export async function startAuthRecovery(licenseId: string, ownerDiscordId: string, target_guild_id: string, limit?: number | null) {
  return platformPost<Record<string, unknown>>(licenseId, ownerDiscordId, "recovery", { target_guild_id, limit });
}

export async function cancelAuthRecovery(licenseId: string, ownerDiscordId: string, taskId: string) {
  return platformPost<{ cancel_requested: boolean }>(licenseId, ownerDiscordId, `recovery/${taskId}/cancel`);
}

export async function getAuthGifts(licenseId: string, ownerDiscordId: string) {
  return platformGet<Array<Record<string, unknown>>>(licenseId, ownerDiscordId, "gifts");
}

export async function createAuthGift(licenseId: string, ownerDiscordId: string, body: { name: string; role_id: string; members_count: number }) {
  return platformPost<Record<string, unknown>>(licenseId, ownerDiscordId, "gifts", body);
}

export async function redeemAuthGift(licenseId: string, ownerDiscordId: string, giftId: string) {
  return platformPost<Record<string, unknown>>(licenseId, ownerDiscordId, `gifts/${giftId}/redeem`);
}

export async function deleteAuthGift(licenseId: string, ownerDiscordId: string, giftId: string) {
  return platformDelete<{ deleted: boolean }>(licenseId, ownerDiscordId, `gifts/${giftId}`);
}

export async function getAuthTeam(licenseId: string, ownerDiscordId: string) {
  return platformGet<Array<Record<string, unknown>>>(licenseId, ownerDiscordId, "team");
}

export async function inviteAuthTeam(licenseId: string, ownerDiscordId: string, discordUserId: string, role = "viewer") {
  return platformPost<Record<string, unknown>>(licenseId, ownerDiscordId, "team/invite", { discord_user_id: discordUserId, role });
}

export async function updateAuthTeamMember(licenseId: string, ownerDiscordId: string, memberId: string, role: string) {
  return platformPatch<{ updated: boolean }>(licenseId, ownerDiscordId, `team/${memberId}`, { role });
}

export async function removeAuthTeamMember(licenseId: string, ownerDiscordId: string, memberId: string) {
  return platformDelete<{ deleted: boolean }>(licenseId, ownerDiscordId, `team/${memberId}`);
}

export async function updateAuthSettings(licenseId: string, ownerDiscordId: string, body: { name?: string; guild_id?: string; verified_role_id?: string; autorole_id?: string; log_channel_id?: string; enabled?: boolean }) {
  return platformPatch<{ updated: boolean }>(licenseId, ownerDiscordId, "settings", body);
}

export async function updateAuthDefinitions(licenseId: string, ownerDiscordId: string, defs: Record<string, boolean>) {
  return platformPatch<{ updated: boolean }>(licenseId, ownerDiscordId, "definitions", defs);
}

export async function rotateAuthCredential(licenseId: string, ownerDiscordId: string) {
  return platformPost<{ integration_key: string }>(licenseId, ownerDiscordId, "credential");
}

export async function getAuthLogs(licenseId: string, ownerDiscordId: string, params: { page?: number; page_size?: number; category?: string; result?: string; user?: string } = {}) {
  return platformGet<{ total: number; page: number; pages: number; items: Array<Record<string, unknown>> }>(licenseId, ownerDiscordId, "logs", params);
}

export async function getAuthTasks(licenseId: string, ownerDiscordId: string) {
  return platformGet<{ items: Array<Record<string, unknown>> }>(licenseId, ownerDiscordId, "tasks");
}
