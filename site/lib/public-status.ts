export type PublicServiceState = "operational" | "degraded" | "unknown";
export type PublicServiceStatus = { label: string; state: PublicServiceState; detail: string; checkedAt: string };

function row(label: string, state: PublicServiceState, detail: string): PublicServiceStatus {
    return { label, state, detail, checkedAt: new Date().toISOString() };
}

export async function getPublicServiceStatus(): Promise<PublicServiceStatus[]> {
    const checkedAt = new Date().toISOString();
    const web = row("Plataforma ZUROS", "operational", "Página pública respondendo agora.");
    web.checkedAt = checkedAt;
    try {
        const { default: databases } = await import("@root/src/databases");
        await databases.applications.findOne({}, { _id: 1 }).maxTimeMS(2_000).lean();
        return [
            web,
            row("Dados e aplicações", "operational", "Banco de aplicações respondeu à verificação."),
            row("Bots hospedados", "unknown", "O estado vivo depende do heartbeat de cada aplicação."),
            row("Pagamentos", process.env.EFI_WEBHOOK_SECRET || process.env.PROMISSEPAY_WEBHOOK_SECRET ? "operational" : "unknown", process.env.EFI_WEBHOOK_SECRET || process.env.PROMISSEPAY_WEBHOOK_SECRET ? "Integração configurada; o provedor não foi cobrado nesta verificação." : "Nenhum provedor configurado neste ambiente."),
        ];
    } catch {
        return [
            web,
            row("Dados e aplicações", "degraded", "Não foi possível verificar o banco agora."),
            row("Bots hospedados", "unknown", "Sem uma leitura confiável de heartbeat."),
            row("Pagamentos", "unknown", "Não foi possível confirmar a disponibilidade do provedor."),
        ];
    }
}
