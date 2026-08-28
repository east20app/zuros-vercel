import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import SessionProvider from "@/components/SessionProvider";
import { ToastProvider } from "@/components/Toast";
import ChunkRecovery from "@/components/ChunkRecovery";
import PwaManager from "@/components/PwaManager";
import { siteUrl } from "@/lib/site-url";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
    themeColor: "#050505",
};
export const metadata: Metadata = {
    metadataBase: siteUrl,
    title: "ZUROS APP",
    description: "Painel de gerenciamento de bots",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/brand-logo-transparent.png", shortcut: "/brand-logo-transparent.png", apple: "/brand-logo-transparent.png" },
    other: { "mobile-web-app-capable": "yes", "apple-mobile-web-app-status-bar-style": "black-translucent" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
<body className="min-h-screen text-zinc-200 antialiased">
                <a href="#main-content" className="skip-link">Pular para o conteúdo principal</a>
                <ChunkRecovery />
                <PwaManager />
                <SessionProvider>
                    <ToastProvider><div id="main-content" tabIndex={-1}>{children}</div></ToastProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
