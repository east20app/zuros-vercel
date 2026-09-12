import mongoose, { Schema, model } from "mongoose";

export interface ISiteUser {
    discordId: string;
    linkedDiscordId?: string;
    discordIdentityCompleted?: boolean;
    name: string;
    username?: string;
    globalName?: string;
    discriminator?: string;
    email?: string;
    emailLoginCodeHash?: string;
    emailLoginCodeExpiresAt?: Date;
    emailLoginCodeRequestedAt?: Date;
    emailLoginCodeAttempts?: number;
    emailLoginSendCount?: number;
    emailLoginSendWindowStart?: Date;
    image?: string;
    avatarHash?: string;
    bannerHash?: string;
    accentColor?: number;
    locale?: string;
    emailVerified?: boolean;
    mfaEnabled?: boolean;
    totpSecretEncrypted?: string;
    totpEnabled?: boolean;
    totpRecoveryHashes?: string[];
    premiumType?: number;
    flags?: number;
    publicFlags?: number;
    guilds?: Array<{ id: string; name: string; icon?: string; owner?: boolean; permissions?: string; features?: string[] }>;
    accessTokenEncrypted?: string;
    refreshTokenEncrypted?: string;
    tokenExpiresAt?: Date;
    authorizedGuildJoin: boolean;
    lastLoginAt: Date;
    firstLoginAt: Date;
    loginCount: number;
}

const schema = new Schema<ISiteUser>({
    discordId: { type: String, required: true, unique: true, index: true },
    linkedDiscordId: { type: String, index: true },
    discordIdentityCompleted: { type: Boolean, default: false },
    name: { type: String, required: true, default: "Usuário Discord" },
    username: { type: String },
    globalName: { type: String },
    discriminator: { type: String },
    email: { type: String },
    emailLoginCodeHash: { type: String, select: false },
    emailLoginCodeExpiresAt: { type: Date, select: false },
    emailLoginCodeRequestedAt: { type: Date, select: false },
    emailLoginCodeAttempts: { type: Number, select: false },
    emailLoginSendCount: { type: Number, select: false },
    emailLoginSendWindowStart: { type: Date, select: false },
    image: { type: String },
    avatarHash: { type: String },
    bannerHash: { type: String },
    accentColor: { type: Number },
    locale: { type: String },
    emailVerified: { type: Boolean },
    mfaEnabled: { type: Boolean },
    totpSecretEncrypted: { type: String, select: false },
    totpEnabled: { type: Boolean, default: false },
    totpRecoveryHashes: [{ type: String, select: false }],
    premiumType: { type: Number },
    flags: { type: Number },
    publicFlags: { type: Number },
    guilds: [{ id: String, name: String, icon: String, owner: Boolean, permissions: String, features: [String] }],
    accessTokenEncrypted: { type: String, select: false },
    refreshTokenEncrypted: { type: String, select: false },
    tokenExpiresAt: { type: Date },
    authorizedGuildJoin: { type: Boolean, required: true, default: false },
    lastLoginAt: { type: Date, required: true, default: Date.now },
    firstLoginAt: { type: Date, required: true, default: Date.now },
    loginCount: { type: Number, required: true, default: 1 },
}, { timestamps: true });

export default (mongoose.models.siteUsers as mongoose.Model<ISiteUser>) || model<ISiteUser>("siteUsers", schema);
