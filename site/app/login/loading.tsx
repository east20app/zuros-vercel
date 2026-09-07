export default function Loading() {
    return (
        <main
            className="flex min-h-dvh items-center justify-center"
            aria-label="Carregando"
        >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </main>
    );
}
