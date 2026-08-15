import mongoose, { Schema, model } from "mongoose";

interface IGlobalSettings {
    key: string;
    value: any;
}

const globalSettingsSchema = new Schema<IGlobalSettings>({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true }
});

const GlobalSettings = (mongoose.models["global-settings"] as mongoose.Model<IGlobalSettings>) || model<IGlobalSettings>("global-settings", globalSettingsSchema);
export default GlobalSettings;