"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { BrandLogo } from "@/components/BrandLogo";

const ERROR_MESSAGES: Record<string, string> = {
    AccessDenied: "Acesso negado. Sua conta Discord não tem permissão para acessar o painel.",
    Configuration: "Erro de configuração no servidor. Informe um administrador.",
    OAuthSignin: "Não foi possível iniciar o login com o Discord. Tente novamente.",
    OAuthCallback: "Falha ao concluir o login com o Discord. Tente novamente.",
    OAuthAccountNotLinked: "Esta conta Discord já está vinculada a outro acesso.",
    Timeout: "O Discord demorou para responder. Verifique o status do serviço e tente novamente em alguns instantes.",
    OAuthCreateAccount: "Não foi possível criar uma conta com o Discord. Tente novamente.",
    Default: "Não foi possível entrar. Tente novamente.",
};

export function LoginForm() {
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const error = searchParams.get("error");
    const [starting, setStarting] = useState(false);

    useEffect(() => { if (status === "authenticated") router.replace("/dashboard"); }, [status, router]);

    async function handleSignIn() {
        setStarting(true);
        await signIn("discord", { callbackUrl: searchParams.get("callbackUrl") || "/dashboard" });
        setStarting(false);
    }

    return <main className="login-shell">
        <div className="zuros-backdrop" aria-hidden /><div className="zuros-grid" aria-hidden />
        <section className="login-visual" aria-label="Sobre a plataforma ZUROS">
            <Link href="/" aria-label="ZUROS — início"><BrandLogo priority className="h-10 w-40" /></Link>
            <div className="login-visual-content"><p className="home-kicker"><span className="home-kicker-mark" />ZUROS / CONTROL ROOM</p><h1>Uma leitura clara do que move sua comunidade.</h1><p>O painel reúne operação, vendas e infraestrutura em um lugar pensado para quem precisa decidir rápido.</p></div>
            <div className="login-visual-footer"><span>01</span><div><b>ACESSO PROPRIETÁRIO</b><small>Entre com a conta Discord vinculada à loja.</small></div></div>
        </section>
        <section className="login-panel animate-fade-up">
            <div className="login-mobile-brand"><Link href="/" aria-label="ZUROS — início"><BrandLogo priority className="h-9 w-36" /></Link></div>
            <div className="login-panel-top"><span className="home-section-index">ENTRAR / 01</span><Link href="/" className="login-back">Voltar ao início <span aria-hidden>↗</span></Link></div>
            <div className="login-copy"><h2>Bem-vindo de volta.</h2><p>Entre com a conta Discord proprietária da loja. É ela que conecta suas aplicações, licenças e faturas.</p></div>
            {error && <div role="alert" className="login-error">{ERROR_MESSAGES[error] || ERROR_MESSAGES.Default}</div>}
            <div className="mt-8">{status === "loading" || starting ? <div className="flex h-14 items-center justify-center"><Spinner /></div> : <button onClick={handleSignIn} className="login-discord-button"><DiscordIcon /><span>Entrar com Discord</span><span aria-hidden className="ml-auto text-lg">↗</span></button>}</div>
            <p className="login-legal">Ao entrar, você concorda em utilizar a plataforma de forma legítima.</p>
            <div className="login-help"><a href="mailto:suporte@zuros.app?subject=Ajuda%20para%20entrar">Precisa de ajuda para entrar?</a><span>O acesso é protegido pela autenticação do Discord.</span></div>
        </section>
    </main>;
}

function DiscordIcon() { return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden><path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291 3.928 1.793 8.18 1.793 12.062 0 .12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892c.36.698.772 1.362 1.225 1.993a19.839 19.839 0 0 0 6.002-3.03c.5-5.177-.838-9.674-3.549-13.66zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419s.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>; }
