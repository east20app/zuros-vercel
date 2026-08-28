export const STEP_LABELS: Record<string, string> = {
    "select-days": "Selecionando plano",
    "select-coupons": "Selecionando cupom",
    "waiting-payment": "Aguardando pagamento",
    "payment-confirmed": "Pagamento confirmado",
};

export const STATUS_LABELS: Record<string, string> = {
    opened: "Aberto",
    closed: "Fechado",
    cancelled: "Cancelado",
    processing: "Processando",
    expired: "Expirado",
};

export const STATUS_TONES: Record<string, string> = {
    opened: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    closed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    cancelled: "border-red-500/20 bg-red-500/10 text-red-300",
    processing: "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#a78bfa]",
    expired: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

export const STEP_TONES: Record<string, string> = {
    "select-days": "border-amber-500/20 bg-amber-500/10 text-amber-300",
    "select-coupons": "border-amber-500/20 bg-amber-500/10 text-amber-300",
    "waiting-payment": "border-amber-500/20 bg-amber-500/10 text-amber-300",
    "payment-confirmed": "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};
