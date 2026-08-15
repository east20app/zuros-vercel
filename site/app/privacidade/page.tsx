import Link from "next/link";
import type { Metadata } from "next";
import { publicMetadata } from "@/lib/site-url";

export const metadata: Metadata = publicMetadata("Política de Privacidade · ZUROS APP", "Entenda como a ZUROS trata dados pessoais, pagamentos, cookies e seus direitos conforme a LGPD.", "/privacidade");

const sections = [
    ["Dados que tratamos", "Ao entrar com Discord, recebemos identificador, nome, avatar e os dados de autenticação necessários. Também tratamos dados de aplicações, lojas, compras, cobranças e registros técnicos de acesso e atividade. A ZUROS não recebe a senha da sua conta Discord."],
    ["Pagamentos", "Pagamentos PIX são processados por provedores como EFI e PromissePay. Eles podem tratar nome, documento, informações da cobrança, identificadores da transação e dados antifraude conforme as próprias políticas. A ZUROS armazena referências e o estado da transação, não credenciais bancárias."],
    ["Finalidades e bases legais", "Usamos os dados para autenticar usuários, prestar e proteger o serviço, processar compras, oferecer suporte, prevenir fraude e cumprir obrigações legais. As bases legais aplicáveis incluem execução de contrato, cumprimento de obrigação legal, legítimo interesse e consentimento, quando exigido."],
    ["Compartilhamento", "Os dados podem ser compartilhados, no mínimo necessário, com Discord, processadores de pagamento, infraestrutura de hospedagem e fornecedores técnicos. Também podemos compartilhá-los para cumprir ordem legal ou proteger direitos da ZUROS e de terceiros."],
    ["Retenção e segurança", "Mantemos os dados durante a relação contratual e, depois, pelos prazos necessários ao cumprimento de obrigações legais, resolução de disputas e prevenção de fraude. Aplicamos controles técnicos e organizacionais, mas nenhum sistema é totalmente imune a incidentes."],
    ["Cookies e armazenamento local", "Usamos cookies essenciais de sessão e autenticação, além de armazenamento local estritamente necessário a preferências e funcionamento da interface. Tecnologias não essenciais, se adicionadas, deverão ser apresentadas com a opção de consentimento aplicável."],
    ["Seus direitos", "Você pode solicitar confirmação e acesso, correção, anonimização, portabilidade, informação sobre compartilhamento, eliminação quando cabível e revisão ou revogação de consentimento. Para exercer seus direitos, escreva para suporte@zuros.app; poderemos confirmar sua identidade antes de atender ao pedido."],
];

export default function PrivacyPage() {
    return <main className="mx-auto max-w-3xl px-5 py-16 text-zinc-300"><Link href="/" className="text-emerald-400">← Início</Link><h1 className="mt-8 text-4xl font-semibold text-white">Política de Privacidade</h1><p className="mt-4 text-sm text-zinc-500">Última atualização: 13 de agosto de 2026.</p><p className="mt-6 leading-7">Esta política explica como a ZUROS trata dados pessoais na plataforma, no painel e nos fluxos de compra.</p><div className="mt-10 space-y-9">{sections.map(([title, body]) => <section key={title}><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-3 leading-7">{body}</p></section>)}</div></main>;
}
