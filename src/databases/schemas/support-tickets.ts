import mongoose, { ObjectId, Schema, model } from "mongoose";
import type { SupportCategory, SupportTicketStatus } from "../../support/types";

export interface ISupportTicket {
    _id: ObjectId;
    guildId: string;
    channelId: string;
    userId: string;
    assignedTo?: string;
    category: SupportCategory;
    status: SupportTicketStatus;
    applicationId?: ObjectId;
    subject?: string;
    createdAt: Date;
    closedAt?: Date;
    closedBy?: string;
}

const schema = new Schema<ISupportTicket>({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    assignedTo: { type: String },
    category: { type: String, enum: ["technical", "application", "payment", "account", "store", "suggestion"], required: true },
    status: { type: String, enum: ["open", "waiting_user", "waiting_staff", "closed"], default: "open", index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "applications" },
    subject: { type: String, maxlength: 160 },
    createdAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },
    closedBy: { type: String },
});
schema.index({ guildId: 1, channelId: 1 }, { unique: true });
schema.index({ userId: 1, status: 1 });
schema.index({ applicationId: 1, status: 1 });

const SupportTickets = (mongoose.models["support_tickets"] as mongoose.Model<ISupportTicket>) || model<ISupportTicket>("support_tickets", schema);
export default SupportTickets;
