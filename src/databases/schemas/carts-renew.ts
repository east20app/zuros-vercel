import mongoose, { ObjectId, Schema, Types, model } from "mongoose";

export interface ICartsRenew {
    userId: string;
    channelId?: string;
    applicationId: ObjectId;
    price: number;
    coupon: ObjectId;
    finalPrice: number;
    grossPriceCents?: number;
    discountCents?: number;
    finalPriceCents?: number;
    couponCodeSnapshot?: string;
    couponDiscountSnapshot?: number;
    couponReservationState?: 'reserved' | 'consumed' | 'released';
    confirmedAt?: Date;
    confirmedBy?: string;
    paymentSource?: 'webhook' | 'polling' | 'manual';
    paymentProvider?: 'efi' | 'promisse' | 'sharpify' | 'manual';
    paymentCheckAttempts?: number;
    nextPaymentCheckAt?: Date;
    lastPaymentCheckAt?: Date;
    deliveryState?: 'opened' | 'payment_pending' | 'payment_confirmed' | 'provisioning' | 'partial_delivery' | 'delivered' | 'retryable_error' | 'cancelled' | 'expired';
    status: "opened" | "closed" | "cancelled" | "processing" | "expired";
    storeId: ObjectId;
    paymentId?: string;
    pix_qrcode?: string;
    delivered?: boolean;
    expiresAt: Date;
    pix_copy_and_paste?: string;
    step: "select-days" | "select-coupons" | "waiting-payment" | "payment-confirmed";
    days?: number;
    lifetime?: boolean;
}

const cartsSchema = new Schema<ICartsRenew>({
    userId: { type: String, required: true },
    channelId: { type: String, required: false },
    applicationId: { type: Types.ObjectId, ref: "applications", required: true },
    storeId: { type: Types.ObjectId, ref: "stores", required: true },
    price: { type: Number, required: false },
    delivered: { type: Boolean, default: false },
    finalPrice: { type: Number, required: false },
    grossPriceCents: { type: Number, required: false, min: 0 },
    discountCents: { type: Number, required: false, min: 0 },
    finalPriceCents: { type: Number, required: false, min: 0 },
    couponCodeSnapshot: { type: String, required: false },
    couponDiscountSnapshot: { type: Number, required: false, min: 0, max: 100 },
    couponReservationState: { type: String, enum: ['reserved', 'consumed', 'released'], required: false },
    confirmedAt: { type: Date, required: false },
    confirmedBy: { type: String, required: false },
    paymentSource: { type: String, enum: ['webhook', 'polling', 'manual'], required: false },
    paymentProvider: { type: String, enum: ['efi', 'promisse', 'sharpify', 'manual'], required: false },
    paymentCheckAttempts: { type: Number, default: 0, min: 0 },
    nextPaymentCheckAt: { type: Date, required: false },
    lastPaymentCheckAt: { type: Date, required: false },
    deliveryState: { type: String, enum: ['opened', 'payment_pending', 'payment_confirmed', 'provisioning', 'partial_delivery', 'delivered', 'retryable_error', 'cancelled', 'expired'], default: 'opened' },
    coupon: { type: Types.ObjectId, ref: "coupons", required: false },
    step: { type: String, enum: ["select-days", "waiting-payment", "payment-confirmed", "select-coupons"], default: "select-days" },
    pix_qrcode: { type: String, required: false },
    pix_copy_and_paste: { type: String, required: false },
    days: { type: Number, required: false },
    lifetime: { type: Boolean, required: false, default: false },
    paymentId: { type: String, required: false },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["opened", "closed", "processing", "cancelled", "expired"], default: "opened" },
}, { timestamps: true });

cartsSchema.index({ userId: 1, status: 1, step: 1 });
cartsSchema.index({ paymentId: 1, status: 1, step: 1 });
cartsSchema.index({ storeId: 1, createdAt: -1 });
cartsSchema.index({ applicationId: 1, createdAt: -1 });

const CartsRenew = (mongoose.models["carts-renew"] as mongoose.Model<ICartsRenew>) || model<ICartsRenew>("carts-renew", cartsSchema);
export default CartsRenew;
