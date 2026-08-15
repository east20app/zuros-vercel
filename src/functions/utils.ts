import { IApplications } from "../databases/schemas/applications";

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function isDiscordInteractionExpiredError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const maybeError = error as { code?: number; status?: number; message?: string };
    const message = maybeError.message?.toLowerCase() ?? "";

    const expiredInteraction =
        (maybeError.code === 10062 || maybeError.status === 404) &&
        message.includes("interaction");

    // O Discord retorna 40060 quando outra rotina ou outra instância do bot
    // reconhece a mesma interação primeiro. Não há uma segunda resposta
    // válida a enviar, portanto esse erro deve encerrar a rotina em silêncio.
    const alreadyAcknowledged =
        maybeError.code === 40060 &&
        message.includes("already been acknowledged");

    return expiredInteraction || alreadyAcknowledged;
}

export async function safeInteractionReply(interaction: { reply?: (...args: any[]) => Promise<unknown>; followUp?: (...args: any[]) => Promise<unknown>; editReply?: (...args: any[]) => Promise<unknown>; deferReply?: (...args: any[]) => Promise<unknown>; deferUpdate?: (...args: any[]) => Promise<unknown>; update?: (...args: any[]) => Promise<unknown> }, action: () => Promise<unknown>): Promise<void> {
    try {
        await action();
    } catch (error) {
        if (isDiscordInteractionExpiredError(error)) {
            return;
        }

        throw error;
    }
}

export async function asyncLoopingExec(timeout: number, functionToExec: () => Promise<void>): Promise<void> {
    while (true) {
        try {
            await functionToExec();
        } catch (error) {
            // Um erro transitório de rede/banco não pode encerrar para sempre
            // os processadores de pagamentos, expiração e atualizações.
            console.error("[BACKGROUND-LOOP] Execução falhou; nova tentativa será feita.", error);
        }
        await new Promise(resolve => setTimeout(resolve, timeout));
    }
}

export const moneyFormatter = (number: number) => {
    return number.toFixed(2);
};

export const getRemainingTimeFormated = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) {
        return "Expirado";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days}d, ${hours}h, ${minutes}m, ${seconds}s`;
};

export function formatUptime(ms: number) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(" ");
}
