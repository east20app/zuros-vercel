import mongoose, { Schema, model, Types } from "mongoose";

export interface IAuthLicense {
  ownerId: string;
  storeId: Types.ObjectId;
  productId: Types.ObjectId;
  purchaseId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  externalLicenseId?: string;
  externalAccountId?: string;
  authId?: string;
  setupCompletedAt?: Date;
  dashboardUrl?: string;
  plan: "basic" | "cloud" | "pro";
  status: "pending" | "active" | "suspended" | "error";
  expiresAt?: Date;
  lifetime: boolean;
  limits: { servers: number; verifiedUsers: number };
  features: string[];
  lastError?: string;
  provisionKey: string;
}

const schema = new Schema<IAuthLicense>(
  {
    ownerId: { type: String, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "products", required: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: "carts-buy", required: true, unique: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "applications" },
    externalLicenseId: { type: String },
    externalAccountId: { type: String },
    authId: { type: String },
    setupCompletedAt: { type: Date },
    dashboardUrl: { type: String },
    plan: { type: String, enum: ["basic", "cloud", "pro"], required: true },
    status: { type: String, enum: ["pending", "active", "suspended", "error"], default: "pending" },
    expiresAt: { type: Date },
    lifetime: { type: Boolean, default: false },
    limits: {
      servers: { type: Number, default: 1, min: 1 },
      verifiedUsers: { type: Number, default: 1000, min: 1 },
    },
    features: { type: [String], default: [] },
    lastError: { type: String },
    provisionKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

// Índices para consultas frequentes
schema.index({ ownerId: 1, status: 1 });
schema.index({ externalLicenseId: 1 }, { sparse: true });
schema.index({ applicationId: 1 }, { sparse: true });

export default (mongoose.models["auth-licenses"] as mongoose.Model<IAuthLicense>) || model<IAuthLicense>("auth-licenses", schema);
