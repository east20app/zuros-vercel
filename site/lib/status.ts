export function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) return "N/A";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatDateOnly(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
}

export function formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type StatusTone = "green" | "red" | "amber" | "zinc" | "blue";

export const STATUS_LABELS: Record<string, string> = {
    active: "Ativo", grace_period: "Período de carência", pending: "Pendente",
    opened: "Em andamento", processing: "Processando", paid: "Pago", approved: "Aprovado",
    completed: "Concluído", closed: "Concluído", cancelled: "Cancelado", canceled: "Cancelado",
    refused: "Recusado", rejected: "Recusado", expired: "Expirado", inactive: "Inativo",
    online: "Online", offline: "Offline", error: "Com erro",
    "select-days": "Selecionando plano", "select-coupons": "Selecionando cupom",
    "waiting-payment": "Aguardando pagamento", "payment-confirmed": "Pagamento confirmado",
};

export const STATUS_TONE: Record<string, StatusTone> = {
    active: "green", paid: "green", approved: "green", completed: "green", closed: "green", online: "green", "payment-confirmed": "green",
    pending: "amber", opened: "amber", processing: "amber", grace_period: "amber", "waiting-payment": "amber",
    "select-days": "blue", "select-coupons": "blue", cancelled: "red", canceled: "red", refused: "red",
    rejected: "red", expired: "red", error: "red", inactive: "zinc", offline: "zinc",
};

export function getStatusLabel(status: string | null | undefined): string {
    if (!status) return "Não informado";
    return STATUS_LABELS[status] || "Status desconhecido";
}

export function getStatusTone(status: string | null | undefined): StatusTone {
    return status ? STATUS_TONE[status] || "zinc" : "zinc";
}

export function getRemainingLabel(expiresAt: string | null, lifetime: boolean): string {
    if (lifetime) return "∞ Lifetime";
    if (!expiresAt) return "Sem expiração";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Vencido";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h restantes`;
    return `${Math.max(0, Math.floor(diff / (1000 * 60 * 60)))}h restantes`;
}

export function isExpiring(expiresAt: string | null, lifetime: boolean): boolean {
    if (lifetime || !expiresAt) return false;
    const expiry = new Date(expiresAt).getTime();
    return expiry - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

export function getRemainingTone(expiresAt: string | null, lifetime: boolean): "green" | "amber" | "red" {
    if (lifetime || !expiresAt) return "green";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "red";
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24 * 3) return "red";
    if (hours < 24 * 7) return "amber";
    return "green";
}

export function maskSecret(value: string | null | undefined): string {
    if (!value) return "";
    if (value.length <= 12) return "••••••••••••";
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export const planLabels: Record<string, { label: string; days?: number }> = {
    weekly: { label: "Semanal", days: 7 },
    biweekly: { label: "Quinzenal", days: 15 },
    monthly: { label: "Mensal", days: 30 },
    lifetime: { label: "Vitalício" },
};
