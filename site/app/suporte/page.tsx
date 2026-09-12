import { getSupportSettings } from "@/lib/actions/support.actions";
import { SupportPortal } from "@/components/SupportPortal";
import { getSessionUser } from "@/lib/require-admin";
import Link from "next/link";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import TileBackground from "@/components/TileBackground";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
    const user = await getSessionUser();
    if (!user) return <div className="reference-public-page min-h-screen overflow-x-clip text-white"><TileBackground /><PublicNavbar /><main className="mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-24 text-center"><p className="home-kicker">ZUROS / SUPORTE</p><h1 className="reference-public-title mt-5">Entre para acessar o suporte.</h1><p className="reference-public-lede mx-auto mt-5">A área de suporte está disponível para contas autenticadas.</p><Link href="/login?callbackUrl=%2Fsuporte" className="home-primary-cta mt-8">Entrar com Discord</Link></main><PublicFooter isAuthenticated={false} /></div>;
    const settings = await getSupportSettings();
    return <div className="reference-public-page min-h-screen overflow-x-clip text-white"><TileBackground /><PublicNavbar user={user} /><main className="support-page"><SupportPortal enabled={settings.enabled} discordInviteUrl={settings.discordInviteUrl} /></main><PublicFooter isAuthenticated /></div>;
}
