"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { BrandLogo } from "@/components/BrandLogo";

const ERROR_MESSAGES: Record<string, string> = {
    AccessDenied:
        "Acesso negado. Sua conta Discord não tem permissão para acessar o painel.",
    Configuration:
        "Erro de configuração no servidor. Informe um administrador.",
    OAuthSignin:
        "Não foi possível iniciar o login com o Discord. Tente novamente.",
    OAuthCallback:
        "Falha ao concluir o login com o Discord. Tente novamente.",
    OAuthAccountNotLinked:
        "Esta conta Discord já está vinculada a outro acesso.",
    Timeout:
        "O Discord demorou para responder. Tente novamente em alguns instantes.",
    OAuthCreateAccount:
        "Não foi possível criar uma conta com o Discord. Tente novamente.",
    Default:
        "Não foi possível entrar. Tente novamente.",
};

function safeCallbackUrl(raw: string | null): string {
    if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
    return raw;
}

export function LoginForm() {
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const error = searchParams.get("error");
    const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

    const [starting, setStarting] = useState(false);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [emailStep, setEmailStep] = useState<"email" | "code">("email");
    const [message, setMessage] = useState("");
    const [emailError, setEmailError] = useState("");
    const [resendAt, setResendAt] = useState(0);
    const [nowTick, setNowTick] = useState(0);

    useEffect(() => {
        if (!resendAt) return;
        setNowTick(Date.now());
        const id = window.setInterval(() => setNowTick(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [resendAt]);

    const resendLeft = resendAt ? Math.max(0, Math.ceil((resendAt - nowTick) / 1000)) : 0;

    useEffect(() => {
        if (status === "authenticated") {
            router.replace(callbackUrl);
        }
    }, [status, router, callbackUrl]);

    async function handleDiscordSignIn() {
        setStarting(true);
        setEmailError("");
        try {
            await signIn("discord", { callbackUrl });
        } catch {
            setEmailError("Não conseguimos abrir o Discord. Tente novamente.");
        } finally {
            setStarting(false);
        }
    }

    async function requestCode(event?: React.FormEvent) {
        if (event) event.preventDefault();
        setStarting(true);
        setEmailError("");
        setMessage("");

        try {
            const response = await fetch("/api/auth/email/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.ok) {
                throw new Error(
                    result.error || "Não foi possível enviar o código."
                );
            }

            if (result.cooldown) {
                setMessage(
                    result.message ||
                        "Você já solicitou um código recentemente. Aguarde um instante para reenviar."
                );
                return;
            }

            setEmailStep("code");
            setResendAt(Date.now() + 60_000);
            setMessage(
                `Enviamos um código de 6 dígitos para ${email}. Confira sua caixa de entrada e o spam.`
            );
        } catch (requestError) {
            setEmailError(
                requestError instanceof Error
                    ? requestError.message
                    : "Não foi possível enviar o código."
            );
        } finally {
            setStarting(false);
        }
    }

    async function verifyCode(event?: React.FormEvent, overrideCode?: string) {
        if (event) event.preventDefault();
        const finalCode = overrideCode ?? code;
        if (starting || finalCode.length !== 6) return;
        setStarting(true);
        setEmailError("");
        setCode(finalCode);

        try {
            const result = await signIn("email-code", {
                email,
                code: finalCode,
                redirect: false,
                callbackUrl,
            });

            if (result?.ok) {
                router.replace(callbackUrl);
            } else {
                setEmailError(
                    "Código inválido, expirado ou com muitas tentativas. Solicite um novo código."
                );
            }
        } catch {
            setEmailError("Não conseguimos confirmar o código. Tente novamente.");
        } finally {
            setStarting(false);
        }
    }

    const loading = status === "loading" || starting;

    return (
        <>
            <header className="auth-topbar">
                <Link href="/" aria-label="ZUROS — início"><BrandLogo priority /></Link>
                <Link href="/suporte" className="auth-help">Precisa de ajuda?</Link>
            </header>
            <div className="auth-layout">
                <aside className="auth-story" aria-label="Sobre o painel">
                    <p className="auth-eyebrow">FEITO PARA O SEU DISCORD</p>
                    <h2>Seu servidor.<br />Do seu jeito.</h2>
                    <p>Cuide dos seus bots, acompanhe os pedidos e deixe as mensagens com a cara da sua comunidade.</p>
                    <ul>
                        <li><span aria-hidden="true">01</span><div><strong>Um lugar para configurar</strong><p>Mensagens, canais e preferências do seu bot.</p></div></li>
                        <li><span aria-hidden="true">02</span><div><strong>Sua loja por perto</strong><p>Produtos, pedidos e pagamentos pelo painel.</p></div></li>
                        <li><span aria-hidden="true">03</span><div><strong>Ajuda quando precisar</strong><p>Abra uma conversa com o suporte pela sua conta.</p></div></li>
                    </ul>
                    <Link href="/planos" className="auth-story-link">Conheça os bots da ZUROS <span aria-hidden="true">→</span></Link>
                </aside>
                <section className="auth-panel" aria-labelledby="login-title">
                    <div className="auth-form">
                        <div className="auth-heading">
                            <p className="auth-eyebrow">SUA CONTA ZUROS</p>
                            <h1 id="login-title">{emailStep === "code" ? "Confira seu e-mail" : "Bom ter você por aqui."}</h1>
                            <p>{emailStep === "code" ? "Digite o código que enviamos para continuar." : "Entre para cuidar dos seus bots e da sua loja."}</p>
                        </div>
                        {error && <div role="alert" className="auth-message is-error">{ERROR_MESSAGES[error] || ERROR_MESSAGES.Default}</div>}
                        {emailError && <div role="alert" className="auth-message is-error">{emailError}</div>}
                        {message && <div role="status" className="auth-message is-success">{message}</div>}
                        <button type="button" onClick={() => void handleDiscordSignIn()} disabled={loading} className="auth-button auth-discord">
                            <DiscordIcon /><span>Entrar com Discord</span>
                        </button>
                        <div className="auth-divider"><span>ou continue com e-mail</span></div>
                        {emailStep === "email" ? (
                            <form onSubmit={requestCode} className="auth-fields" aria-busy={loading}>
                                <label htmlFor="login-email">Endereço de e-mail</label>
                                <input id="login-email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" className="auth-input" disabled={loading} />
                                <p className="auth-field-hint">Enviamos um código de acesso. Você não precisa de senha.</p>
                                <button type="submit" className="auth-button auth-primary" disabled={loading}>
                                    {loading ? <Spinner /> : null}{starting ? "Enviando…" : "Receber código de acesso"}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={verifyCode} className="auth-fields" aria-busy={loading}>
                                <label htmlFor="login-code">Código de verificação</label>
                                <input id="login-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus value={code} onChange={(event) => {
                                    const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                                    setCode(next);
                                    if (next.length === 6) void verifyCode(undefined, next);
                                }} placeholder="000000" className="auth-input auth-code" disabled={loading} />
                                <button type="submit" className="auth-button auth-primary" disabled={loading || code.length !== 6}>
                                    {loading ? <Spinner /> : null}{starting ? "Confirmando…" : "Entrar na minha conta"}
                                </button>
                                <div className="auth-resend">
                                    <button type="button" disabled={loading || resendLeft > 0} onClick={() => void requestCode()}>{resendLeft > 0 ? `Reenviar em ${resendLeft}s` : "Reenviar código"}</button>
                                    <button type="button" disabled={loading} onClick={() => { setEmailStep("email"); setCode(""); setMessage(""); setEmailError(""); setResendAt(0); }}>Usar outro e-mail</button>
                                </div>
                            </form>
                        )}
                        <p className="auth-terms">Ao continuar, você concorda com os <Link href="/termos">Termos de uso</Link> e a <Link href="/privacidade">Política de privacidade</Link>.</p>
                    </div>
                </section>
            </div>
            <footer className="auth-bottom"><span>© {new Date().getFullYear()} ZUROS</span><Link href="/">Voltar ao site</Link></footer>
        </>
    );
}

function DiscordIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="login-discord-svg"
            aria-hidden
        >
            <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291 3.928 1.793 8.18 1.793 12.062 0 .12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892c.36.698.772 1.362 1.225 1.993a19.839 19.839 0 0 0 6.002-3.03c.5-5.177-.838-9.674-3.549-13.66zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419s.955-2.157 2.157-2.157c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}
