import type { Metadata } from "next";
import { publicMetadata } from "@/lib/site-url";

export const metadata: Metadata = {
    ...publicMetadata(
        "Iniciar sessão | ZUROS APP",
        "Acesse o painel ZUROS para gerenciar bots, lojas e aplicações.",
        "/login"
    ),

    applicationName: "ZUROS APP",
    authors: [{ name: "ZUROS APP" }],
    creator: "ZUROS APP",

    keywords: [
        "bot discord",
        "bot de vendas discord",
        "loja discord",
        "pix discord",
        "tickets discord",
        "verificação discord",
        "ZUROS",
    ],

    robots: {
        index: false,
        follow: false,
    },

    openGraph: {
        type: "website",
        locale: "pt_BR",
        siteName: "ZUROS APP",
        title: "ZUROS APP — bots, lojas e aplicações para Discord",
        description:
            "Gerencie bots, lojas, pagamentos, tickets e aplicações Discord em um único painel.",
        url: "/login",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                type: "image/png",
                alt: "ZUROS APP — bots, lojas e aplicações para Discord",
            },
        ],
    },

    twitter: {
        card: "summary_large_image",
        title: "ZUROS APP — bots, lojas e aplicações para Discord",
        description:
            "Gerencie bots, lojas, pagamentos, tickets e aplicações Discord em um único painel.",
        images: ["/og-image.png"],
    },

    icons: {
        icon: "/brand/icon.png",
        apple: "/brand/icon-maskable.png",
    },

    themeColor: "#0c0f14",
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
