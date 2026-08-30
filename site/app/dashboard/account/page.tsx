import Image from "next/image";
import { requireUser } from "@/lib/require-admin";
import { UserChip } from "@/components/ui";

export default async function AccountPage() {
    const user = await requireUser();
    return <main className="account-page mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="account-heading"><div><p className="home-kicker"><span className="home-kicker-mark" />CONTA / IDENTIDADE</p><h1>Seu espaço de acesso.</h1><p>Seus dados de identidade são sincronizados a partir do Discord.</p></div><span className="account-heading-code">ACCOUNT / 01</span></section>
        <section className="account-card"><div className="account-profile"><div className="account-avatar">{user.image ? <Image unoptimized src={user.image} alt="" width={80} height={80} className="h-20 w-20 rounded-[1.25rem] object-cover" /> : <span>{(user.name || "Z").slice(0, 2).toUpperCase()}</span>}</div><div><p className="account-card-kicker">PERFIL PRINCIPAL</p><h2>{user.name || "Conta ZUROS"}</h2><p>Conectado via Discord</p></div></div><dl className="account-details"><div><dt>Nome</dt><dd>{user.name || "—"}</dd></div><div><dt>E-mail</dt><dd>{user.email || "—"}</dd></div><div><dt>Conta Discord</dt><dd><UserChip userId={user.discordId} name={user.name} avatarUrl={user.image} /></dd></div></dl></section>
    </main>;
}
