import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui";

export default function NotFound() {
    return (
        <>
            <Navbar />
            <main className="flex flex-col items-center justify-center gap-4 px-4 py-32 text-center">
                <p className="bg-gradient-to-b from-emerald-300 to-emerald-600 bg-clip-text text-7xl font-black text-transparent">404</p>
                <h1 className="text-lg font-semibold text-white">Página não encontrada</h1>
                <p className="max-w-md text-sm text-zinc-500">
                    O endereço que você tentou acessar não existe ou foi movido.
                </p>
                <div className="mt-2">
                    <Button href="/dashboard">Ir para o painel</Button>
                </div>
            </main>
        </>
    );
}
