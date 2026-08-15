export function getErrorMessage(error: unknown, fallback = "Ocorreu um erro."): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message: unknown }).message;
        if (typeof message === "string" && message) return message;
    }
    return fallback;
}
