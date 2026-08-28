import mongoose, { ObjectId, Schema, model } from "mongoose";

export interface ICoupons {
    storeId: ObjectId;
    code: string;
    discount: number;
    remainingUses: number;
    expiresAt: Date;
    roles?: string[];
    products?: string[];
}

const couponSchema = new Schema<ICoupons>({
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    discount: { type: Number, required: true, min: 0, max: 100 },
    remainingUses: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Usos restantes devem ser um número inteiro." } },
    expiresAt: { type: Date, required: true },
    roles: { type: [String], required: false },
    products: { type: [String], required: false, default: ["all"] },
});

couponSchema.index({ storeId: 1, code: 1 }, { unique: true });

const Coupons = (mongoose.models["coupons"] as mongoose.Model<ICoupons>) || model<ICoupons>("coupons", couponSchema);
export default Coupons;
