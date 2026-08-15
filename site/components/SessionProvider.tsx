"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextAuthSessionProvider
            // Não refetch ao focar a janela/aba: quando o /api/auth/session
            // responde `{}` de forma transitória (ex.: durante o reload de um
            // Server Action em navegação), o client marcava a sessão como
            // unauthenticated e derrubava o usuário para o login.
            refetchOnWindowFocus={false}
        >
            {children}
        </NextAuthSessionProvider>
    );
}
