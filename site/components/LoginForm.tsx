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

export function LoginForm() {
    const { status } = useSession();

    const router = useRouter();
    const searchParams = useSearchParams();

    const error = searchParams.get("error");

    const callbackUrl =
        searchParams.get("callbackUrl") || "/dashboard";

    const [starting, setStarting] = useState(false);

    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");

    const [emailStep, setEmailStep] =
        useState<"email" | "code">("email");

    const [message, setMessage] = useState("");
    const [emailError, setEmailError] = useState("");

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/dashboard");
        }
    }, [status, router]);

    async function handleDiscordSignIn() {
        setStarting(true);

        await signIn("discord", {
            callbackUrl,
        });

        setStarting(false);
    }

    async function requestCode(
        event: React.FormEvent
    ) {
        event.preventDefault();

        setStarting(true);
        setEmailError("");
        setMessage("");

        try {
            const response = await fetch(
                "/api/auth/email/request",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        email,
                    }),
                }
            );

            const result = await response
                .json()
                .catch(() => ({}));

            if (!response.ok || !result.ok) {
                throw new Error(
                    result.error ||
                        "Não foi possível enviar o código."
                );
            }

            setEmailStep("code");

            setMessage(
                "Confira sua caixa de entrada e digite o código de 6 dígitos."
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

    async function verifyCode(
        event: React.FormEvent
    ) {
        event.preventDefault();

        setStarting(true);
        setEmailError("");

        const result = await signIn(
            "email-code",
            {
                email,
                code,
                redirect: false,
                callbackUrl,
            }
        );

        if (result?.ok) {
            router.replace(callbackUrl);
        } else {
            setEmailError(
                "Código inválido ou expirado. Solicite um novo código e tente novamente."
            );
        }

        setStarting(false);
    }

    const loading =
        status === "loading" || starting;

    return (
        <div className="login-simple-shell">
            <section
                className="login-simple-panel"
                aria-labelledby="login-title"
            >
                <div className="login-panel-top">
                    <Link
                        href="/"
                        aria-label="ZUROS — início"
                        className="login-simple-logo"
                    >
                        <BrandLogo
                            priority
                            className="h-9 w-36"
                        />
                    </Link>

                    <div className="login-status">
                        <span className="login-status-dot" />
                        Sistema online
                    </div>
                </div>

                <div className="login-simple-heading">
                    <span className="login-simple-eyebrow">
                        PAINEL ZUROS
                    </span>

                    <h1 id="login-title">
                        Bem-vindo de volta.
                    </h1>

                    <p>
                        Entre na sua conta para acessar
                        e gerenciar suas aplicações.
                    </p>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="login-error"
                    >
                        {ERROR_MESSAGES[error] ||
                            ERROR_MESSAGES.Default}
                    </div>
                )}

                {emailError && (
                    <div
                        role="alert"
                        className="login-error"
                    >
                        {emailError}
                    </div>
                )}

                {message && (
                    <div
                        role="status"
                        className="login-success"
                    >
                        {message}
                    </div>
                )}

                {loading ? (
                    <div
                        className="login-simple-loading"
                        aria-label="Processando"
                    >
                        <Spinner />
                    </div>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={handleDiscordSignIn}
                            className="login-discord-button"
                        >
                            <DiscordIcon />

                            <span>
                                Entrar com Discord
                            </span>

                            <span
                                aria-hidden
                                className="login-button-arrow"
                            >
                                ↗
                            </span>
                        </button>

                        <div className="login-divider">
                            <span>
                                ou continue com e-mail
                            </span>
                        </div>

                        {emailStep === "email" ? (
                            <form
                                onSubmit={requestCode}
                                className="login-form-fields"
                            >
                                <label
                                    className="sr-only"
                                    htmlFor="login-email"
                                >
                                    E-mail
                                </label>

                                <input
                                    id="login-email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(
                                            event.target.value
                                        )
                                    }
                                    placeholder="seu@email.com"
                                    className="login-email-input"
                                />

                                <button
                                    type="submit"
                                    className="login-email-button"
                                >
                                    Enviar código
                                </button>
                            </form>
                        ) : (
                            <form
                                onSubmit={verifyCode}
                                className="login-form-fields"
                            >
                                <label
                                    className="sr-only"
                                    htmlFor="login-code"
                                >
                                    Código recebido por e-mail
                                </label>

                                <input
                                    id="login-code"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    required
                                    autoComplete="one-time-code"
                                    value={code}
                                    onChange={(event) =>
                                        setCode(
                                            event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 6)
                                        )
                                    }
                                    placeholder="000000"
                                    className="login-email-input login-code-input"
                                />

                                <button
                                    type="submit"
                                    className="login-email-button"
                                >
                                    Confirmar código
                                </button>

                                <button
                                    type="button"
                                    className="login-change-email"
                                    onClick={() => {
                                        setEmailStep("email");
                                        setCode("");
                                        setMessage("");
                                        setEmailError("");
                                    }}
                                >
                                    Usar outro e-mail
                                </button>
                            </form>
                        )}
                    </>
                )}

                <div className="login-security">
                    <div className="login-security-icon">
                        ✓
                    </div>

                    <div>
                        <strong>
                            Acesso seguro
                        </strong>

                        <span>
                            Seus dados são protegidos e
                            nunca compartilhados.
                        </span>
                    </div>
                </div>

                <Link
                    href="/"
                    className="login-simple-back"
                >
                    ← Voltar ao início
                </Link>
            </section>
        </div>
    );
}

function DiscordIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-current"
            aria-hidden
        >
            <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291 3.928 1.793 8.18 1.793 12.062 0 .12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892c.36.698.772 1.362 1.225 1.993a19.839 19.839 0 0 0 6.002-3.03c.5-5.177-.838-9.674-3.549-13.66zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419s.955-2.157 2.157-2.157c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}
