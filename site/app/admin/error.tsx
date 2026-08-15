"use client";

import { ErrorState } from "@/components/PageState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState error={error} reset={reset} />;
}
