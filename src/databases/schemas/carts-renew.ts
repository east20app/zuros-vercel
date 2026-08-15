import mongoose, { ObjectId, Schema, Types, model } from "mongoose";

export interface ICartsRenew {
    userId: string;
    channelId?: string;
    applicationId: ObjectId;
    price: number;
    coupon: ObjectId;
    finalPrice: number;
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
