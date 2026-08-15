import client from "../bot-client";
import databases from "../databases";

/**
 * BUG CORRIGIDO: `user.send(message)` não tinha `await`. Como a chamada
 * está dentro de um try/catch síncrono na aparência, mas `send` é async,
 * uma rejeição da Promise NÃO era capturada pelo catch — virava um
 * unhandled promise rejection (em produção isso pode até derrubar o
 * processo dependendo da config do Node).
 */
export const notifyUser = async ({ userId, message }: { userId: string, message: any }) => {
    try {
        const user = client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
        if (!user) {
            console.error(`User with ID ${userId} not found.`);
            return;
        }

        await user.send(message);
    } catch (error) {
        console.error(`Error notifying user ${userId}:`, error);
    }
}

interface INotifyChannelLog {
    storeId?: string;
    logName: "sales" | "transferOwnership" | "autoUpdate" | "renovations" | "errors" | "expiredApplication";
    message: any;
}

export const notifyChannelLog = async ({ storeId, logName, message }: INotifyChannelLog) => {
    try {
        if (!logName || !message) {
            return;
        }

        let channelId: string | null = null;

        if (storeId) {
            const storeConfig = await databases.stores.findOne({ _id: storeId }, { logsAndRoles: 1 });
            if (storeConfig?.logsAndRoles) {
                channelId = (storeConfig.logsAndRoles as any)[logName] || null;
            }
        }

        if (!channelId) {
            const channelId_db = await databases.globalSettings.findOne({ key: "logs" });
            if (!channelId_db) return;
            channelId = channelId_db?.value?.[logName] || null;
        }

        if (!channelId) return;

        const channel = client.channels.cache.get(channelId);
        if (!channel || !channel.isSendable()) {
            console.error(`Channel with ID ${channelId} not found or is not a text channel.`);
            return;
        }

        await channel.send(message);
    } catch (error) {
        console.error(`Error notifying log ${logName}:`, error);
    }
}
