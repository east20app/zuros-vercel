import mongoose, { ObjectId, Schema, Types, model } from "mongoose";

export interface IApplications {
    _id: ObjectId;
    name: string;
    ownerId: string,
    storeId: ObjectId,
    botId: string;
    appId?: string,
    serverId?: string,
    token: string,
    productId: ObjectId,
    expiresAt?: Date;
    version: string;
    lifetime: boolean;
    status: "grace_period" | "active";
    updateAttempts: number;
    errorOnUpdate: boolean;
    errorOnUpdateMessage?: string;
    forceUpdate?: boolean;
    updateLeaseUntil?: Date;
    renewalOperationKeys?: string[];
}

const settingsSchema = new Schema<IApplications>({
    name: { type: String, required: true },
    ownerId: { type: String, required: true },
    storeId: { type: Types.ObjectId, ref: "stores", required: true },
    botId: { type: String, required: true },
    appId: { type: String, required: false },
    serverId: { type: String, required: false, default: "" },
    token: { type: String, required: true },
    productId: { type: Types.ObjectId, ref: "products", required: true },
    expiresAt: { type: Date, required: false },
    version: { type: String, required: false, default: "1.0.0" },
    lifetime: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ["grace_period", "active"], default: "active" },
    updateAttempts: { type: Number, required: true, default: 0 },
    errorOnUpdate: { type: Boolean, required: true, default: false },
    errorOnUpdateMessage: { type: String, required: false },
    forceUpdate: { type: Boolean, required: true, default: false },
    updateLeaseUntil: { type: Date, required: false },
    renewalOperationKeys: { type: [String], default: [], select: false },
});

settingsSchema.index({ storeId: 1 });
settingsSchema.index({ ownerId: 1 });
settingsSchema.index({ productId: 1 });
settingsSchema.index({ appId: 1 }, { unique: true, sparse: true });

const Applications = (mongoose.models["applications"] as mongoose.Model<IApplications>) || model<IApplications>("applications", settingsSchema);
export default Applications;
