const questions = [
    ["O que acontece se eu não renovar?", "Quando o plano vence, a aplicação entra em período de carência e fica pausada. Durante esse prazo você ainda pode renovar sem perder a configuração; depois dele, a infraestrutura pode ser desativada."],
    ["O que é o período de carência?", "É uma janela de segurança após o vencimento. Ela evita que uma falha ou atraso no pagamento apague imediatamente a sua aplicação."],
    ["Como funciona o suporte?", "O suporte orienta sobre acesso, cobrança, infraestrutura e uso do painel. Use o Discord da comunidade ou envie um e-mail para suporte@zuros.app."],
];

export function FaqAccordion() {
    return <div className="divide-y divide-white/[.07] overflow-hidden rounded-2xl border border-white/[.07] bg-surface/80">
        {questions.map(([question, answer]) => <details key={question} className="group px-5 py-1 sm:px-7">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-white marker:content-none">{question}<span aria-hidden className="text-xl text-emerald-400 transition group-open:rotate-45">+</span></summary>
            <p className="max-w-3xl pb-5 text-sm leading-6 text-zinc-400">{answer}</p>
        </details>)}
    </div>;
}
