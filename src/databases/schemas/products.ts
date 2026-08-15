import mongoose, { ObjectId, Schema, model } from "mongoose";

export interface IProducts {
    _id: ObjectId;
    storeId: ObjectId;
    name: string;
    runtimeEnvironment: "python" | "nodejs" | "java" | "go" | "rust" | "dotnet" | "deno"
    runCommand: string
    needToUpdateApplications: boolean;
    messageSettings?: {
        channelId?: string;
        messageId?: string;
        buttonName?: string;
        video?: string;
        banner?: string;
        description?: string;
    };
    redeemSettings?: {
        active: boolean;
        days?: number;
        webhook?: string;
    };
    prices?: {
        weekly?: number;
        biweekly?: number;
        monthly?: number;
        lifetime?: number;
    };
    protectedFiles?: string[];
    memoryMB?: number;
    currentReleaseVersion?: string;
    lastReleaseCreatedVersion: string;
    releases?: Array<
        {
            _id: ObjectId;
            version: string;
            date: Date;
            path: string;
        }
    >
}

const productsSchema = new Schema<IProducts>({
    storeId: { type: Schema.Types.ObjectId, ref: "stores", required: true },
    name: { type: String, required: true },
    runtimeEnvironment: { type: String, enum: ["python", "nodejs", "java", "go", "rust", "dotnet", "deno"], required: true },
    runCommand: { type: String, required: true }, // e.g., "node index.js", "python app.py"
    needToUpdateApplications: { type: Boolean, required: true, default: false },
    messageSettings: {
        channelId: { type: String, required: false },
        messageId: { type: String, required: false },
        buttonName: { type: String, required: true, default: "Comprar" },
        video: { type: String, required: false },
        banner: { type: String, required: false },
        description: { type: String, required: false },
    },
    redeemSettings: {
        active: { type: Boolean, required: true, default: false },
        days: { type: Number, required: false },
        webhook: { type: String, required: false },
    },
    prices: {
        weekly: { type: Number, required: false },
        biweekly: { type: Number, required: false },
        monthly: { type: Number, required: false },
        lifetime: { type: Number, required: false },
    },
    protectedFiles: { type: [String], required: false, default: [] },
    memoryMB: { type: Number, required: false, default: 256 },
    currentReleaseVersion: { type: String, required: false },
    lastReleaseCreatedVersion: { type: String, required: true, default: "0.0.0" },
    releases: [
        {
            _id: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
            version: { type: String, required: true },
            date: { type: Date, required: true, default: Date.now },
            path: { type: String, required: true },
        }
    ]
});

productsSchema.index({ _id: 1, storeId: 1 });
productsSchema.index({ storeId: 1 });

const Products = (mongoose.models["products"] as mongoose.Model<IProducts>) || model<IProducts>("products", productsSchema);
export default Products;
