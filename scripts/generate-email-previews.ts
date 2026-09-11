import fs from "node:fs";
import { renderEmail } from "../src/lib/email-layout";

const previews: Array<[string, ReturnType<typeof renderEmail>]> = [
    ["pagamento-aprovado.html", renderEmail({ eyebrow: "PAGAMENTO APROVADO", heroTitle: "Pagamento aprovado", heroSubtitle: "Sua aplicação está pronta.", greeting: "Olá, cliente ZUROS.", intro: "Seu pedido foi confirmado pelo sistema.", fields: [{ label: "Produto", value: "Zuros Prime" }, { label: "Plano", value: "monthly" }, { label: "Valor", value: "R$ 8,99" }, { label: "Aplicação", value: "Minha aplicação" }, { label: "Válido até", value: "11 de setembro de 2026 às 17:40" }], primaryCta: { label: "Acessar Dashboard", href: "/dashboard" }, secondaryCta: { label: "Ver Aplicação", href: "/dashboard/apps/minha-aplicacao" }, campaign: "payment_confirmed" })],
    ["renovacao.html", renderEmail({ eyebrow: "RENOVAÇÃO", heroTitle: "Seu plano vence em 1 dia", heroSubtitle: "Renove agora para evitar interrupção do serviço.", greeting: "Olá, cliente ZUROS.", intro: "O plano da sua aplicação está próximo do vencimento.", fields: [{ label: "Aplicação", value: "Minha aplicação" }, { label: "Vencimento", value: "12 de setembro de 2026 às 17:40" }], primaryCta: { label: "Renovar Agora", href: "/dashboard/renovar/minha-aplicacao" }, campaign: "renewal_reminder" })],
    ["pagamento-recusado.html", renderEmail({ eyebrow: "PAGAMENTO RECUSADO", heroTitle: "Não foi possível confirmar seu pagamento", heroSubtitle: "Revise os dados e tente novamente.", greeting: "Olá, cliente ZUROS.", intro: "O pagamento não foi confirmado pelo sistema.", fields: [{ label: "Produto", value: "Zuros Prime" }, { label: "Valor", value: "R$ 8,99" }], primaryCta: { label: "Tentar Novamente", href: "/dashboard" }, campaign: "payment_failed" })],
];
fs.mkdirSync("previews/emails", { recursive: true });
for (const [name, rendered] of previews) fs.writeFileSync(`previews/emails/${name}`, rendered.html);
