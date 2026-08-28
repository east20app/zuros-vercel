import { BrandLogo } from "@/components/BrandLogo";
import { Skeleton } from "@/components/ui";

export default function GlobalLoading() {
    return (
        <main className="relative min-h-screen px-5 py-10" aria-busy="true" aria-label="Carregando página">
            <div className="zuros-backdrop" aria-hidden />
            <div className="zuros-grid" aria-hidden />
            <div className="mx-auto max-w-6xl">
                <BrandLogo className="h-10 w-40" />
                <div className="mt-12 space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-12 max-w-xl" />
                    <Skeleton className="h-5 max-w-2xl" />
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}
                </div>
            </div>
        </main>
    );
}
