export type SupportTicketStatus = "open" | "waiting_user" | "waiting_staff" | "closed";
export type SupportCategory = "technical" | "application" | "payment" | "account" | "store" | "suggestion";
export type SafeApplication = {
    id: string;
    name: string;
    botId: string;
    appId?: string;
    productName: string;
    status: string;
    version: string;
    lifetime: boolean;
    expiresAt?: Date;
    serverId?: string;
    online: boolean | null;
    uptime?: number | null;
};
