import databases from "../databases";
import efiWrapper from "../functions/efi_wrapper";

export const MAX_CERTIFICATE_SIZE = 5 * 1024 * 1024;
export async function saveEfiCertificate(args: { requesterId: string; certificate: Buffer }): Promise<{ valid: boolean }> {
    if (!args.certificate.length) throw new Error("O certificado está vazio.");
    if (args.certificate.length > MAX_CERTIFICATE_SIZE) throw new Error("O certificado excede o limite de 5 MB.");
    const settings = await databases.userSettings.findOne({ userId_discord: args.requesterId });
    if (!settings) throw new Error("Usuário não cadastrado.");
    await databases.userSettings.updateOne({ userId_discord: args.requesterId }, { $set: { "efi_credentials.cert": args.certificate.toString("base64") } });
    const payment = await efiWrapper.updateCredentials(args.requesterId).catch(() => null);
    return { valid: !!payment?.isValid };
}
