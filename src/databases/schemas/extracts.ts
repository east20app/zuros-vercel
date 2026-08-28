import mongoose, { Schema, model } from "mongoose";

export interface IExtracts {
    origin: "sales" | "manual";
    action: "add" | "remove";
    description?: string;
    amount: number;
    storeId: string;
    operationKey?: string;
}

const extractsSchema = new Schema<IExtracts>({
    origin: { type: String, enum: ["sales", "manual"], required: true },
    action: { type: String, enum: ["add", "remove"], required: true },
    description: { type: String, required: false },
    storeId: { type: String, required: true },
    amount: { type: Number, required: true },
    operationKey: { type: String, required: false },
}, 
{
    timestamps: true,
});

extractsSchema.index({ origin: 1, action: 1, createdAt: -1 });
extractsSchema.index({ storeId: 1, createdAt: -1 });
extractsSchema.index({ operationKey: 1 }, { unique: true, sparse: true });

const Extracts = (mongoose.models["extracts"] as mongoose.Model<IExtracts>) || model<IExtracts>("extracts", extractsSchema);
export default Extracts;
