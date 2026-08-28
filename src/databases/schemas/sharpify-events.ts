import mongoose, { Schema, model } from "mongoose";

export interface ISharpifyEvent {
    webhookId: string;
    ownerDiscordId: string;
    eventId: string;
    name: string;
    context: string;
    contextId: string;
    occurredAt: Date;
    payload: Record<string, unknown>;
}

const schema = new Schema<ISharpifyEvent>({
    webhookId: { type: String, required: true, unique: true, index: true },
    ownerDiscordId: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    name: { type: String, required: true },
    context: { type: String, required: true },
    contextId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    payload: { type: Object, required: true },
}, { timestamps: true });

export default (mongoose.models["sharpify-events"] as mongoose.Model<ISharpifyEvent>) || model<ISharpifyEvent>("sharpify-events", schema);