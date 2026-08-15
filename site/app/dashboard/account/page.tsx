import Image from "next/image";
import { requireUser } from "@/lib/require-admin";
import { PageHeader, UserChip } from "@/components/ui";

export default async function AccountPage() {
    const user = await requireUser();
    return <main className="mx-auto max-w-6xl px-5 py-10">
        <PageHeader title="Perfil" subtitle="Seus dados de identidade são sincronizados a partir do Discord." />
        <section className="zuros-card zuros-card-lit mt-8 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {user.image ? <Image unoptimized src={user.image} alt="" width={64} height={64} className="h-16 w-16 rounded-full border border-zinc-700 object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-xl font-semibold text-emerald-400">{(user.name || "Z").slice(0, 2).toUpperCase()}</span>}
                <dl className="grid flex-1 gap-5 sm:grid-cols-3">
                    <div><dt className="text-xs text-zinc-500">Nome</dt><dd className="mt-1 text-sm font-medium text-white">{user.name || "—"}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-zinc-500">E-mail</dt><dd className="mt-1 truncate text-sm font-medium text-white">{user.email || "—"}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-zinc-500">Conta Discord</dt><dd className="mt-1"><UserChip userId={user.discordId} name={user.name} avatarUrl={user.image} /></dd></div>
                </dl>
            </div>
        </section>
    </main>;
}
