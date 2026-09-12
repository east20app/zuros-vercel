"use server";

import crypto from "node:crypto";
import QRCode from "qrcode";
import databases from "@root/src/databases";
import { decryptOAuthToken, encryptOAuthToken } from "@root/src/functions/oauth-crypto";
import { requireSessionUser } from "./context";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(bytes: Buffer) { let bits = ""; for (const byte of bytes) bits += byte.toString(2).padStart(8, "0"); let out = ""; for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]; return out; }
function normalizeSecret(value: string) { return value.replace(/[^A-Z2-7]/gi, "").toUpperCase(); }
function secretBytes(secret: string) { let bits = ""; for (const char of normalizeSecret(secret)) bits += alphabet.indexOf(char).toString(2).padStart(5, "0"); const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(bytes); }
function token(secret: string, counter: number) { const hash = crypto.createHmac("sha1", secretBytes(secret)).update(Buffer.from(counter.toString(16).padStart(16, "0"), "hex")).digest(); const offset = hash[hash.length - 1] & 15; const value = ((hash[offset] & 127) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3]; return String(value % 1_000_000).padStart(6, "0"); }
function validToken(secret: string, supplied: string) { const current = Math.floor(Date.now() / 1000 / 30); return [-1, 0, 1].some((step) => token(secret, current + step) === supplied.trim()); }

export async function getSecurityStatus() { const userId = await requireSessionUser(); const user = await databases.siteUsers.findOne({ discordId: userId }, { totpEnabled: 1, emailVerified: 1 }).lean(); return { totpEnabled: Boolean(user?.totpEnabled), emailVerified: Boolean(user?.emailVerified) }; }
export async function beginAuthenticatorSetup() { const userId = await requireSessionUser(); const user = await databases.siteUsers.findOne({ discordId: userId }).lean(); if (user?.totpEnabled) throw new Error("O Google Authenticator já está ativado."); const secret = base32(crypto.randomBytes(20)); const label = encodeURIComponent(`ZUROS:${user?.email || userId}`); const uri = `otpauth://totp/${label}?secret=${secret}&issuer=ZUROS&algorithm=SHA1&digits=6&period=30`; const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 }); await databases.siteUsers.updateOne({ discordId: userId }, { $set: { totpSecretEncrypted: encryptOAuthToken(secret), totpEnabled: false } }); return { secret, uri, qrDataUrl }; }
export async function confirmAuthenticatorSetup(code: string) { const userId = await requireSessionUser(); const user = await databases.siteUsers.findOne({ discordId: userId }).select("+totpSecretEncrypted"); if (!user?.totpSecretEncrypted) throw new Error("Inicie a configuração do autenticador primeiro."); const secret = decryptOAuthToken(user.totpSecretEncrypted); if (!/^\d{6}$/.test(code) || !validToken(secret, code)) throw new Error("Código inválido. Confira o horário do celular e tente novamente."); await databases.siteUsers.updateOne({ discordId: userId }, { $set: { totpEnabled: true, mfaEnabled: true } }); return { ok: true }; }
export async function disableAuthenticator(code: string) { const userId = await requireSessionUser(); const user = await databases.siteUsers.findOne({ discordId: userId }).select("+totpSecretEncrypted"); if (!user?.totpSecretEncrypted || !user.totpEnabled) return { ok: true }; if (!validToken(decryptOAuthToken(user.totpSecretEncrypted), code)) throw new Error("Código inválido."); await databases.siteUsers.updateOne({ discordId: userId }, { $unset: { totpSecretEncrypted: "", totpEnabled: "", mfaEnabled: "" } }); return { ok: true }; }
