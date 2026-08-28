import mongoose, { Schema, model } from "mongoose";

export interface IPaymentEvent {
    eventKey: string;
    cartType: "buy" | "renew";
    cartId: string;
    provider: "efi" | "promisse" | "sharpify" | "manual";
    externalPaymentId: string;
    source: "webhook" | "polling" | "manual";
    status: string;
    amountCents?: number;
    currency: string;
    payloadHash: string;
    sanitizedPayload?: Record<string, unknown>;
    requestId?: string;
}

const paymentEventSchema = new Schema<IPaymentEvent>({
    eventKey: { type: String, required: true, unique: true },
    cartType: { type: String, enum: ["buy", "renew"], required: true },
    cartId: { type: String, required: true, index: true },
    provider: { type: String, enum: ["efi", "promisse", "sharpify", "manual"], required: true },
    externalPaymentId: { type: String, required: true, index: true },
    source: { type: String, enum: ["webhook", "polling", "manual"], required: true },
    status: { type: String, required: true },
    amountCents: { type: Number },
    currency: { type: String, default: "BRL" },
    payloadHash: { type: String, required: true },
    sanitizedPayload: { type: Schema.Types.Mixed },
    requestId: { type: String },
}, { timestamps: true });
paymentEventSchema.index({ provider: 1, externalPaymentId: 1, createdAt: -1 });

export default (mongoose.models["payment-events"] as mongoose.Model<IPaymentEvent>) || model<IPaymentEvent>("payment-events", paymentEventSchema);
