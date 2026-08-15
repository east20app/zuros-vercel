export function safeReleaseEntryPath(entryName: string): string {
    const normalized = entryName.replace(/\\/g, "/");
    const parts = normalized.split("/");
    if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || parts.includes("..")) {
        throw new Error("O arquivo ZIP contém um caminho inseguro.");
    }
    return normalized;
}
