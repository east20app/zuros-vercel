import mongoose, { ObjectId, Schema, model } from "mongoose";

export interface IStores {
    _id: ObjectId;
    name: string;
    ownerId_campos: string;
    teamId_campos?: string;
    balance: number;
    creditedOperationKeys?: string[];
    logsAndRoles?: {
        sales?: string | null;
        renovations?: string | null;
        transferOwnership?: string | null;
        expiredApplication?: string | null;
        customerRole?: string | null;
    }
    permissions: [{
        userId: string;
        permissions: string[];
    }]
}

const settingsSchema = new Schema<IStores>({
    name: { type: String, required: true },
    ownerId_campos: { type: String, required: true },
    teamId_campos: { type: String, default: null },
    balance: { type: Number, default: 0 },
    creditedOperationKeys: { type: [String], default: [], select: false },
    logsAndRoles: {
        sales: { type: String, default: null },
        renovations: { type: String, default: null },
        transferOwnership: { type: String, default: null },
        expiredApplication: { type: String, default: null },
        customerRole: { type: String, default: null }
    },
    permissions: [{
        userId: { type: String, required: true },
        permissions: { type: [String], default: [] }
    }]
});

settingsSchema.index({ ownerId_campos: 1 });
const Stores = (mongoose.models["stores"] as mongoose.Model<IStores>) || model<IStores>("stores", settingsSchema);
export default Stores;
