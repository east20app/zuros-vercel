import type { Metadata } from "next";
import "@/app/globals.css";
import SessionProvider from "@/components/SessionProvider";
import { ToastProvider } from "@/components/Toast";
import ChunkRecovery from "@/components/ChunkRecovery";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
    metadataBase: siteUrl,
    title: "ZUROS APP",
    description: "Painel de gerenciamento de bots",
    icons: { icon: "/icon.svg", shortcut: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
            <body className="min-h-screen text-zinc-200 antialiased">
                <ChunkRecovery />
                <SessionProvider>
                    <ToastProvider>{children}</ToastProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
