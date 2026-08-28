import Link from "next/link";
import type { Metadata } from "next";
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

export default function TermsPage() {
    return <main className="mx-auto max-w-3xl px-5 py-16 text-zinc-300"><Link href="/" className="text-emerald-400">← Início</Link><h1 className="mt-8 text-4xl font-semibold text-white">Termos de Uso</h1><p className="mt-4 text-sm text-zinc-500">Última atualização: 13 de agosto de 2026.</p><div className="mt-10 space-y-9">{sections.map(([title, body]) => <section key={title}><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-3 leading-7">{body}</p></section>)}</div></main>;
}
