import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MAX_CERTIFICATE_SIZE, saveEfiCertificate } from "@root/src/integration/certificates";
export const runtime = "nodejs";
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.discordId;
    if (!requesterId) return Response.json({ error: "Não autenticado." }, { status: 401 });
    try {
        const length = Number(request.headers.get("content-length") || 0);
        if (length > MAX_CERTIFICATE_SIZE + 64_000) throw new Error("O certificado excede o limite de 5 MB.");
        const form = await request.formData(); const file = form.get("certificate");
        if (!(file instanceof File)) throw new Error("Selecione o certificado.");
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (!extension || !["p12", "pfx", "pem"].includes(extension)) throw new Error("Use um certificado .p12, .pfx ou .pem.");
        const result = await saveEfiCertificate({ requesterId, certificate: Buffer.from(await file.arrayBuffer()) });
        return Response.json(result);
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Falha ao salvar certificado." }, { status: 400 }); }
}
