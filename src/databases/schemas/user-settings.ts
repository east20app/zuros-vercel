import mongoose, { Schema, model } from "mongoose";

export interface ISettings {
    userId_discord: string;
    userId_campos: string;
    /** @deprecated legado; novas gravações usam settings.token_campos */
    token_campos?: string;
    efi_credentials?: {
        client_id?: string;
        client_secret?: string;
        pix_key?: string;
        cert?: string
    };
    manual_payment_credentials?: {
        pix_key?: string;
        key_type?: "email" | "cpf" | "cnpj" | "phone" | "random";
    }
    promissepay_credentials?: {
        api_key?: string;
    }
    payment_gateway?: "efi" | "manual" | "promisse";
    settings?: Record<string, string>;
}

const settingsSchema = new Schema<ISettings>({
    userId_discord: { type: String, required: true, unique: true },
    userId_campos: { type: String, required: true },
    token_campos: { type: String, required: false, select: false },
    efi_credentials: {
        client_id: { type: String, default: "" },
        client_secret: { type: String, default: "" },
        pix_key: { type: String, default: "" },
        cert: { type: String, default: null }
    },
    manual_payment_credentials: {
        pix_key: { type: String, default: "" },
        key_type: { type: String, enum: ["email", "cpf", "cnpj", "phone", "random"] }
    },
    promissepay_credentials: {
        api_key: { type: String, default: "" },
    },
    payment_gateway: { type: String, enum: ["efi", "manual", "promisse"], default: "manual" },
    settings: { type: Object, default: {} }
});

settingsSchema.index({ userId_campos: 1 });

const UserSettings = (mongoose.models["user-settings"] as mongoose.Model<ISettings>) || model<ISettings>("user-settings", settingsSchema);
export default UserSettings;
