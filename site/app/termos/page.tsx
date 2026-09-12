import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/require-admin";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import TileBackground from "@/components/TileBackground";
import { publicMetadata } from "@/lib/site-url";

export const metadata: Metadata = publicMetadata("Termos de Uso · ZUROS APP", "Consulte as regras de uso, cobranças, renovação e responsabilidades da plataforma ZUROS.", "/termos");

const sections = [
    ["Aceitação e elegibilidade", "Ao usar a ZUROS, você aceita estes termos e declara ter capacidade para contratar. Você deve fornecer dados legítimos, proteger suas credenciais e cumprir a legislação e os termos do Discord e de outros serviços integrados."],
    ["Uso permitido", "É proibido usar a plataforma para fraude, abuso, invasão, spam, conteúdo ilícito, violação de direitos de terceiros ou tentativa de contornar controles de segurança, cobrança ou limites técnicos."],
    ["Planos, renovação e cancelamento", "Preço, periodicidade, recursos e eventual período de carência são informados antes da compra. Planos não vitalícios exigem renovação para continuidade. O usuário pode deixar de renovar; a aplicação poderá ser pausada no vencimento e removida após a carência informada no painel."],
    ["Reembolsos", "Pedidos de cancelamento ou reembolso serão analisados conforme a oferta apresentada na compra, a natureza do serviço já prestado e a legislação aplicável. Entre em contato com suporte@zuros.app e informe a transação. Nada nestes termos limita direitos obrigatórios do consumidor."],
    ["Responsabilidades", "A ZUROS fornece painel, automações, integrações e infraestrutura gerenciada conforme o plano. O lojista é responsável pelos produtos, conteúdo, suporte comercial, permissões e dados que publica; o usuário é responsável pelos tokens, configurações e uso de suas aplicações. Serviços de terceiros podem sofrer indisponibilidade fora do controle da ZUROS."],
    ["Suspensão e encerramento", "Podemos limitar ou suspender contas por falta de pagamento, risco de segurança, abuso, violação destes termos ou exigência legal. Quando possível, avisaremos e permitiremos correção. Violações graves ou urgentes podem resultar em suspensão imediata."],
    ["Alterações e contato", "Podemos atualizar estes termos para refletir mudanças legais ou no serviço. Alterações materiais serão comunicadas pelos canais disponíveis. Dúvidas podem ser enviadas para suporte@zuros.app."],
];

export default async function TermsPage() {
    const user = await getSessionUser();
    return <div className="reference-public-page min-h-screen overflow-x-clip text-white"><TileBackground /><PublicNavbar user={user} /><main className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24"><div className="legal-shell"><Link href="/" className="legal-back">← Início</Link><p className="legal-kicker">ZUROS / DOCUMENTAÇÃO</p><h1 className="legal-title">Termos de Uso</h1><p className="legal-updated">Última atualização: 13 de agosto de 2026.</p><div className="legal-copy">{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></div></main><PublicFooter isAuthenticated={!!user} /></div>;
}
