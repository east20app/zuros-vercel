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
            router.replace("/dashboard");
        }
    }, [status, router]);

    async function handleDiscordSignIn() {
        setStarting(true);
        await signIn("discord", { callbackUrl });
        setStarting(false);
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
        } finally {
            setStarting(false);
        }
    }

    const loading = status === "loading" || starting;

    return (
        <>
            {/* ─── LEFT COLUMN: LOGIN FORM ─── */}
            <div className="login-left">
                <div className="login-left-inner">
                    <Link
                        href="/"
                        aria-label="ZUROS — início"
                        className="login-logo-link"
                    >
                        <BrandLogo
                            priority
                            className="h-8 w-32"
                        />
                    </Link>

                    <div className="login-header">
                        <span className="login-eyebrow">
                            PAINEL ZUROS
                        </span>
                        <h1 id="login-title" className="login-title">
                            Iniciar sessão
                        </h1>
                        <p className="login-subtitle">
                            Acesse sua conta para continuar.
                        </p>
                    </div>

                    {error && (
                        <div role="alert" className="login-message login-message--error">
                            {ERROR_MESSAGES[error] || ERROR_MESSAGES.Default}
                        </div>
                    )}

                    {emailError && (
                        <div role="alert" className="login-message login-message--error">
                            {emailError}
                        </div>
                    )}

                    {message && (
                        <div role="status" className="login-message login-message--success">
                            {message}
                        </div>
                    )}

                    {loading ? (
                        <div className="login-loading" aria-label="Processando">
                            <Spinner />
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleDiscordSignIn}
                                className="login-btn login-btn--discord"
                            >
                                <DiscordIcon />
                                <span>Entrar com Discord</span>
                            </button>

                            <div className="login-divider">
                                <span>OU E-MAIL</span>
                            </div>

                            {emailStep === "email" ? (
                                <form onSubmit={requestCode} className="login-form-fields">
                                    <label className="login-field-label" htmlFor="login-email">
                                        ENDEREÇO DE E-MAIL
                                    </label>
                                    <input
                                        id="login-email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        className="login-input"
                                    />
                                    <button
                                        type="submit"
                                        className="login-btn login-btn--primary"
                                    >
                                        Enviar código
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={verifyCode} className="login-form-fields">
                                    <label className="login-field-label" htmlFor="login-code">
                                        CÓDIGO DE VERIFICAÇÃO
                                    </label>
                                    <input
                                        id="login-code"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                        required
                                        autoComplete="one-time-code"
                                        autoFocus
                                        value={code}
                                        onChange={(e) => {
                                            const next = e.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 6);
                                            setCode(next);
                                            if (next.length === 6) {
                                                void verifyCode(undefined, next);
                                            }
                                        }}
                                        placeholder="000000"
                                        className="login-input login-input--code"
                                    />
                                    <button
                                        type="submit"
                                        className="login-btn login-btn--primary"
                                    >
                                        Confirmar código
                                    </button>
                                    <div className="login-resend-row">
                                        {resendLeft > 0 ? (
                                            <span
                                                className="login-change-email"
                                                role="status"
                                                aria-live="polite"
                                            >
                                                Reenviar código em {resendLeft}s
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="login-change-email"
                                                onClick={() => void requestCode()}
                                            >
                                                Reenviar código
                                            </button>
                                        )}
                                        <span className="login-resend-sep">·</span>
                                        <button
                                            type="button"
                                            className="login-change-email"
                                            onClick={() => {
                                                setEmailStep("email");
                                                setCode("");
                                                setMessage("");
                                                setEmailError("");
                                                setResendAt(0);
                                            }}
                                        >
                                            Usar outro e-mail
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}

                    <div className="login-footer">
                        <Link href="/termos" className="login-footer-link">
                            Termos
                        </Link>
                        <span className="login-footer-sep">·</span>
                        <Link href="/privacidade" className="login-footer-link">
                            Privacidade
                        </Link>
                        <span className="login-footer-sep">·</span>
                        <span className="login-footer-copy">
                            © 2026 ZUROS
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── RIGHT COLUMN: PRESENTATION ─── */}
            <div className="login-right">
                <div className="login-right-inner">
                    <div className="login-present-text">
                        <span className="login-present-badge">ZUROS</span>
                        <h2 className="login-present-title">
                            Gerencie suas aplicações em{" "}
                            <span className="login-present-highlight">um só lugar.</span>
                        </h2>
                        <p className="login-present-desc">
                            Uma plataforma completa para gerenciar seus bots,
                            aplicações, vendas e operações com simplicidade.
                        </p>
                    </div>

                    <div className="login-dashboard-mock">
                        <div className="login-dash-topbar">
                            <span className="login-dash-logo-text">ZUROS</span>
                            <span className="login-dash-status">
                                <span className="login-dash-status-dot" />
                                Online
                            </span>
                        </div>

                        <div className="login-dash-body">
                            <div className="login-dash-stats">
                                <div className="login-dash-card">
                                    <span className="login-dash-card-label">Vendas</span>
                                    <span className="login-dash-card-value">R$ 4.280</span>
                                    <span className="login-dash-card-change login-dash-card-change--up">
                                        +24.8%
                                    </span>
                                </div>
                                <div className="login-dash-card">
                                    <span className="login-dash-card-label">Usuários</span>
                                    <span className="login-dash-card-value">1.293</span>
                                    <span className="login-dash-card-change login-dash-card-change--up">
                                        +12.3%
                                    </span>
                                </div>
                                <div className="login-dash-card">
                                    <span className="login-dash-card-label">Bots</span>
                                    <span className="login-dash-card-value">8 Ativos</span>
                                    <span className="login-dash-card-change">
                                        Todos online
                                    </span>
                                </div>
                            </div>

                            <div className="login-dash-chart">
                                <div className="login-dash-chart-header">
                                    <span>Atividade</span>
                                    <span className="login-dash-chart-period">7 dias</span>
                                </div>
                                <div className="login-dash-chart-area">
                                    <svg
                                        viewBox="0 0 400 100"
                                        preserveAspectRatio="none"
                                        className="login-dash-chart-svg"
                                    >
                                        <defs>
                                            <linearGradient id="lg-fill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="rgba(124,58,237,0.25)" />
                                                <stop offset="100%" stopColor="rgba(124,58,237,0)" />
                                            </linearGradient>
                                        </defs>
                                        <path
                                            d="M0,80 C40,70 80,50 120,55 C160,60 200,30 240,35 C280,40 320,20 360,25 L400,18 L400,100 L0,100 Z"
                                            fill="url(#lg-fill)"
                                        />
                                        <path
                                            d="M0,80 C40,70 80,50 120,55 C160,60 200,30 240,35 C280,40 320,20 360,25 L400,18"
                                            fill="none"
                                            stroke="rgba(124,58,237,0.6)"
                                            strokeWidth="2"
                                        />
                                    </svg>
                                </div>
                            </div>

                            <div className="login-dash-apps">
                                <div className="login-dash-app">
                                    <span className="login-dash-app-icon">🛒</span>
                                    <div className="login-dash-app-info">
                                        <span className="login-dash-app-name">ZUROS Store</span>
                                        <span className="login-dash-app-status login-dash-app-status--on">
                                            Online
                                        </span>
                                    </div>
                                </div>
                                <div className="login-dash-app">
                                    <span className="login-dash-app-icon">🔐</span>
                                    <div className="login-dash-app-info">
                                        <span className="login-dash-app-name">ZUROS Auth</span>
                                        <span className="login-dash-app-status login-dash-app-status--on">
                                            Online
                                        </span>
                                    </div>
                                </div>
                                <div className="login-dash-app">
                                    <span className="login-dash-app-icon">📊</span>
                                    <div className="login-dash-app-info">
                                        <span className="login-dash-app-name">ZUROS Panel</span>
                                        <span className="login-dash-app-status login-dash-app-status--on">
                                            Online
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="login-benefits">
                        <div className="login-benefit-card">
                            <div className="login-benefit-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </div>
                            <span className="login-benefit-title">Aplicações</span>
                            <span className="login-benefit-desc">
                                Gerencie suas aplicações.
                            </span>
                        </div>
                        <div className="login-benefit-card">
                            <div className="login-benefit-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="16 18 22 12 16 6" />
                                    <polyline points="8 6 2 12 8 18" />
                                </svg>
                            </div>
                            <span className="login-benefit-title">Automação</span>
                            <span className="login-benefit-desc">
                                Simplifique seus processos.
                            </span>
                        </div>
                        <div className="login-benefit-card">
                            <div className="login-benefit-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <span className="login-benefit-title">Controle</span>
                            <span className="login-benefit-desc">
                                Tenha tudo organizado.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
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
