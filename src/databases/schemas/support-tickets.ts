import mongoose, { ObjectId, Schema, model } from "mongoose";
import type { SupportCategory, SupportTicketStatus } from "../../support/types";

export interface ISupportTicket {
    _id: ObjectId;
    guildId?: string;
    channelId?: string;
    userId: string;
    assignedTo?: string;
    category: SupportCategory;
    status: SupportTicketStatus;
    applicationId?: ObjectId;
    subject?: string;
    source?: "discord" | "web";
    priority?: "low" | "normal" | "high" | "urgent";
    requesterEmail?: string;
    messages?: Array<{ authorId: string; authorName: string; body: string; createdAt: Date; internal?: boolean }>;
    participants?: string[];
    updatedAt?: Date;
    createdAt: Date;
    closedAt?: Date;
    closedBy?: string;
}

const schema = new Schema<ISupportTicket>({
    guildId: { type: String },
    channelId: { type: String },
    userId: { type: String, required: true },
    assignedTo: { type: String },
    category: { type: String, enum: ["technical", "application", "payment", "account", "store", "suggestion"], required: true },
    status: { type: String, enum: ["open", "waiting_user", "waiting_staff", "closed"], default: "open", index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "applications" },
    subject: { type: String, maxlength: 160 },
    source: { type: String, enum: ["discord", "web"], default: "web", index: true },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
    requesterEmail: { type: String },
    messages: [{ authorId: String, authorName: String, body: String, createdAt: { type: Date, default: Date.now }, internal: Boolean }],
    participants: [{ type: String }],
    updatedAt: { type: Date, default: Date.now, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },
    closedBy: { type: String },
});
schema.index({ guildId: 1, channelId: 1 }, { unique: true, partialFilterExpression: { guildId: { $exists: true }, channelId: { $exists: true } } });
schema.index({ userId: 1, status: 1 });
schema.index({ applicationId: 1, status: 1 });

const SupportTickets = (mongoose.models["support_tickets"] as mongoose.Model<ISupportTicket>) || model<ISupportTicket>("support_tickets", schema);
export default SupportTickets;
