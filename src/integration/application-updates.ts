import AdmZip from "adm-zip";
import ignore from "ignore";
import databases from "../databases";
import sdkWrapper from "../functions/camposcloud-sdk";
import { buildApplicationPackageConfig } from "./apps";
import { buildHostedBotPackageFromBuffer } from "../functions/hosted-bot";
import { readReleaseBuffer } from "../functions/release-storage";

const MAX_UPDATE_ATTEMPTS = 3;
const UPDATE_LEASE_MS = 4 * 60 * 1000;

export interface ProductUpdateResult {
    matched: number;
    updated: number;
    failed: number;
    pending: number;
}

function errorMessage(error: unknown): string {
    const responseMessage = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
    const value = responseMessage?.error || responseMessage?.message || (error instanceof Error ? error.message : error);
    return String(value || "Erro desconhecido ao atualizar a aplicação.").slice(0, 1000);
}

/** Distribui a release atual com trava para o site e o bot não atualizarem a mesma aplicação. */
export async function processProductApplicationUpdates(productId: string): Promise<ProductUpdateResult> {
    const product = await databases.products.findById(productId);
    if (!product) throw new Error("Produto não encontrado.");
    if (!product.currentReleaseVersion) throw new Error("Defina uma release atual antes de atualizar os bots.");

    const store = await databases.stores.findById(product.storeId);
    if (!store) throw new Error("Loja não encontrada.");
    const owner = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
    if (!owner) throw new Error("Configuração do proprietário da hospedagem não encontrada.");

    const sdk = await sdkWrapper.getInstance(owner.userId_discord).catch(() => null);
    if (!sdk?.isValid) throw new Error("Não foi possível conectar à CamposCloud. Verifique a chave da API nas configurações.");

    const version = String(product.currentReleaseVersion);
    const storedRelease = await readReleaseBuffer(productId, version, `releases/${productId}/${version}.zip`).catch(() => null);
    if (!storedRelease) throw new Error(`O arquivo da release v${version} não está disponível.`);

    const archive = new AdmZip(storedRelease);
    const protectedMatcher = ignore().add(product.protectedFiles || []);
    for (const entry of archive.getEntries()) {
        if (protectedMatcher.ignores(entry.entryName)) archive.deleteFile(entry.entryName);
    }
    const releaseBuffer = archive.toBuffer();
    const pendingVersion = { $or: [{ version: { $ne: version } }, { forceUpdate: true }] };
    const availableLease = { $or: [{ updateLeaseUntil: { $exists: false } }, { updateLeaseUntil: { $lte: new Date() } }] };
    const matched = await databases.applications.countDocuments({ productId: product._id, ...pendingVersion });

    let updated = 0;
    let failed = 0;
    while (true) {
        const app = await databases.applications.findOneAndUpdate(
            { productId: product._id, errorOnUpdate: false, $and: [pendingVersion, availableLease] },
            { $set: { updateLeaseUntil: new Date(Date.now() + UPDATE_LEASE_MS) } },
            { new: true },
        );
        if (!app) break;

        try {
            if (!app.appId) throw new Error("Aplicação sem ID da CamposCloud.");
            const camposApp = await sdk.instance.getApplication({ appId: app.appId });
            if (!camposApp) throw new Error("Aplicação não encontrada na CamposCloud.");
            if (camposApp.data?.currentResourceMetrics?.online) await camposApp.stop().catch(() => null);

            const zipBuffer = buildHostedBotPackageFromBuffer(releaseBuffer, {
                ...buildApplicationPackageConfig({
                    token: app.token,
                    ownerId: app.ownerId,
                    applicationId: String(app._id),
                    botId: app.botId,
                    version,
                    serverId: app.serverId,
                }),
                preserveExistingConfig: true,
            });
            await camposApp.uploadFile({ file: zipBuffer, path: "/" });
            await camposApp.start().catch(() => null);
            await databases.applications.updateOne(
                { _id: app._id },
                { $set: { version, forceUpdate: false, updateAttempts: 0, errorOnUpdate: false }, $unset: { errorOnUpdateMessage: "", updateLeaseUntil: "" } },
            );
            updated++;
        } catch (error) {
            const attempts = (app.updateAttempts || 0) + 1;
            await databases.applications.updateOne(
                { _id: app._id },
                {
                    $set: { updateAttempts: attempts, errorOnUpdate: attempts >= MAX_UPDATE_ATTEMPTS, errorOnUpdateMessage: errorMessage(error) },
                    $unset: { updateLeaseUntil: "" },
                },
            );
            if (attempts >= MAX_UPDATE_ATTEMPTS) failed++;
        }
    }

    const pending = await databases.applications.countDocuments({ productId: product._id, errorOnUpdate: false, ...pendingVersion });
    product.needToUpdateApplications = pending > 0;
    await product.save();
    return { matched, updated, failed, pending };
}