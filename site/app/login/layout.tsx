import type { Metadata } from "next";
import { publicMetadata } from "@/lib/site-url";

export const metadata: Metadata = publicMetadata("Entrar · ZUROS APP", "Acesse com Discord o painel de gerenciamento de bots, lojas e aplicações ZUROS.", "/login");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
