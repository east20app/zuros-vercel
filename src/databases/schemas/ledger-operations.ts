import mongoose, { Schema, model } from "mongoose";

export interface ILedgerOperation {
    operationKey: string;
    cartType: "buy" | "renew";
    cartId: string;
    storeId: string;
    externalPaymentId: string;
    provider: "efi" | "promisse" | "sharpify" | "manual";
    amountCents: number;
    state: "pending" | "applied" | "failed";
    appliedAt?: Date;
    failureCode?: string;
}

const ledgerOperationSchema = new Schema<ILedgerOperation>({
    operationKey: { type: String, required: true, unique: true },
    cartType: { type: String, enum: ["buy", "renew"], required: true },
    cartId: { type: String, required: true, index: true },
    storeId: { type: String, required: true, index: true },
    externalPaymentId: { type: String, required: true },
    provider: { type: String, enum: ["efi", "promisse", "sharpify", "manual"], required: true },
    amountCents: { type: Number, required: true, min: 0 },
    state: { type: String, enum: ["pending", "applied", "failed"], default: "pending" },
    appliedAt: { type: Date },
    failureCode: { type: String },
}, { timestamps: true });
ledgerOperationSchema.index({ provider: 1, externalPaymentId: 1, cartType: 1 }, { unique: true });

export default (mongoose.models["ledger-operations"] as mongoose.Model<ILedgerOperation>) || model<ILedgerOperation>("ledger-operations", ledgerOperationSchema);
