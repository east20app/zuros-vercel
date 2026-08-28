import client from "./bot-client";
import databases from "./databases";
import efiWrapper from "./functions/efi_wrapper";
import promisseWrapper from "./functions/promisse_wrapper";
import sharpifyWrapper from "./functions/sharpify_wrapper";
import sdkWrapper from "./functions/camposcloud-sdk";

import { asyncLoopingExec } from "./functions";
import { getCartMessage } from "./events/buy.event";
import { changeBalance } from "./functions/extracts";
import { notifyChannelLog, notifyUser } from "./functions/notify-wrapper";
import { IStores } from "./databases/schemas/stores";
import { getCartMessageRenew } from "./commands/apps";
import { InteractionResponse } from "discord.js";
import { buildHostedBotPackageFromBuffer } from "./functions/hosted-bot";
import { processProductApplicationUpdates } from "./integration/application-updates";
import { confirmCartPayment } from "./integration/purchases";
import { releaseCouponReservation } from "./integration/coupon-reservations";

let validPresences = [] as string[];
let currentActivity = 0;

export const renewCartsMessage = new Map<string, InteractionResponse>();

const GRACE_PERIOD_DAYS = 4;

asyncLoopingExec(6000, async () => {
    if (!client?.user) {
        return; 
    }


    const presencesDatabase = await databases.globalSettings.findOne({ key: "rich_presences" });
    const presences = presencesDatabase?.value as string[] || [];

    validPresences = presences?.filter((presence) => presence);
    if (!validPresences?.length) {
        client.user.setPresence({ });
        return;
    }

    if (currentActivity >= validPresences.length) {
        currentActivity = 0;
    }

    client.user.setActivity(validPresences[currentActivity], { type: 4 });
    currentActivity++; // Incrementa o índice para a próxima atividade
});

/**
 * Esse cronjob é responsável por verificar se os pagamentos via PIX foram concluídos.
 * Após a conclusão, ele atualiza o carrinho e notifica o usuário.
 * 
 * Ele verifica a cada 5 segundos se há carrinhos abertos com o status "waiting-payment".
 * Se encontrar algum, ele consulta o status do pagamento via efiWrapper e atualiza o carrinho.
 */
/** Reconciliação de pagamentos: o webhook é o caminho principal; este job é somente fallback. */
asyncLoopingExec(15000, async () => {
    const now = new Date();
    const targets = [
        { type: "buy" as const, model: databases.cartsBuy },
        { type: "renew" as const, model: databases.cartsRenew },
    ];
    for (const target of targets) {
        const carts = await (target.model as any).find({ status: "opened", step: "waiting-payment", paymentId: { $exists: true, $ne: "" }, $or: [{ nextPaymentCheckAt: { $exists: false } }, { nextPaymentCheckAt: { $lte: now } }] }).sort({ nextPaymentCheckAt: 1 }).limit(50);
        for (const cart of carts) {
            const attempts = Math.max(0, Number(cart.paymentCheckAttempts || 0));
            try {
                const result = await confirmCartPayment({ paymentId: String(cart.paymentId), type: target.type, source: "polling" });
                if (result.status === "confirmed" || result.status === "already_confirmed") {
                    if (target.type === "buy") {
                        const messageData = await getCartMessage(String(cart.channelId));
                        const channel = client.channels.cache.get(String(cart.channelId));
                        if (channel?.isThread() && messageData) await channel.send(messageData).catch(() => null);
                    } else {
                        const message = renewCartsMessage.get(String(cart._id));
                        const updated = message ? await getCartMessageRenew(String(cart._id)) : null;
                        if (message && updated) await message.edit(updated).catch(() => null);
                        renewCartsMessage.delete(String(cart._id));
                    }
                    continue;
                }
                const delayMs = Math.min(300000, 15000 * 2 ** Math.min(attempts, 4));
                await (target.model as any).updateOne({ _id: cart._id, step: "waiting-payment" }, { $set: { lastPaymentCheckAt: now, nextPaymentCheckAt: new Date(Date.now() + delayMs) }, $inc: { paymentCheckAttempts: 1 } });
            } catch (error) {
                console.error(`[PAYMENT_RECONCILIATION] cart=${cart._id} type=${target.type}`, error instanceof Error ? error.message : "unknown");
            }
        }
    }
});

/** Expira carrinhos ainda não confirmados e devolve reservas de cupom. */asyncLoopingExec(5000, async () => {
    const buyCarts = await databases.cartsBuy.find({ status: "opened", step: { $ne: "payment-confirmed" }, expiresAt: { $lte: new Date() } });

    for (const cart of buyCarts) {
        try {
            await releaseCouponReservation({ cartType: "buy", cartId: String(cart._id) });
            await databases.cartsBuy.updateOne({ _id: cart._id }, { $set: { status: "expired", deliveryState: "expired" } });
            const channel = await client.channels.fetch(cart.channelId).catch(() => null);

            if (channel && channel.isThread()) {
                await channel.bulkDelete(100, true).catch(() => {});
                await channel.send({ content: "`⚠️`・Este carrinho expirou! Ele será fechado em 10 segundos." }).catch(() => {});

                setTimeout(async () => {
                    await channel.delete().catch(() => {});
                }, 10000);
            }else{
                if (!cart.channelId?.startsWith("web:")) {
                    console.error(`\`⚠️\`・O carrinho expirou, mas o canal não é um thread ou não foi encontrado. ID: ${cart.channelId}`);
                }
            }
        } catch (error) {
            console.error(`⚠️ Erro ao expirar o carrinho ${cart._id}:`, error);
        }
    }

    const renewCarts = await databases.cartsRenew.find({ status: "opened", expiresAt: { $lte: new Date() } });

    for (const cart of renewCarts) {
        try {
            await releaseCouponReservation({ cartType: "renew", cartId: String(cart._id) });
            await databases.cartsRenew.updateOne({ _id: cart._id }, { $set: { status: "expired", deliveryState: "expired" } });

            const message = renewCartsMessage.get(cart._id.toString());
            if (message){
                const updatedMessageData = await getCartMessageRenew(cart._id.toString());
                if (updatedMessageData){
                    await message.edit(updatedMessageData).catch((error) => console.warn("⚠️ Erro ao editar a mensagem do carrinho de renovação na hora de expirar:", error));
                }
            }

            // Mesmo fix de memory leak: carrinho expirado não precisa mais ficar em cache.
            renewCartsMessage.delete(cart._id.toString());
        } catch (error) {
            console.error(`⚠️ Erro ao expirar o carrinho de renovação ${cart._id}:`, error);
        }
    }
})


/**
 * Esse cronjob é responsável por verificar se as aplicações expiraram.
 * Após expirar, ela é marcada como "grace_period" e é renovada pelo tempo do "GRACE_PERIOD_DAYS".
 * 
 * Após expirar o grace period, a aplicação é deletada.
 */
asyncLoopingExec(3000, async () => {
    const expiredApplications = await databases.applications.find({ expiresAt: { $lte: new Date() }, lifetime: false }).populate("storeId");
    if (!expiredApplications.length) return;

    for (const application of expiredApplications) {

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            // console.error(`\`⚠️\`・Aplicação com ID ${application._id} não possui configuração de loja válida.`);
            continue;
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
        if (!ownerStoreConfig) {
            // console.error(`\`⚠️\`・Configuração de loja do dono da aplicação com ID ${application._id} não encontrada.`);
            continue;
        }

        const sdk = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
        if (!sdk || !sdk.isValid) {
            // console.error(`\`⚠️\`・Não foi possível conectar-se ao SDK para a aplicação com ID ${application._id}.`);
            continue;
        }

        try {
            if (application.status === "grace_period"){

                // Caso o erro for 404, significa que a aplicação já foi deletada da CamposCloud, então vamos apenas deletar a aplicação da nossa DB.
                // Caso o erro for diferente de 404, vamos lançar o erro para capturar no catch.
                await sdk.instance.deleteApplication({appId: application.appId!}).catch((error) => {
                    if (error?.response?.status === 404) {
                        console.log(`🛡️ A aplicação ${application.appId} já foi deletada da CamposCloud, deletando da nossa DB.`);
                        return;
                    }

                    throw error;
                });

                await databases.applications.deleteOne({ _id: application._id });

                const notifyContent = [
                    `# Aviso importante sobre sua aplicação! 😿`,
                    `Olá <@${application.ownerId}>, sua aplicação expirou e foi deletada!\n`,
                    `- Você não poderá mais utilizá-la, pois ela foi removida do sistema.`,
                    `> Para criar uma nova aplicação, entre no servidor ${storeConfig.name} e compre outra.\n`,
                    `-# Aplicação: ${application.name} - ID ${application.appId}`,
                    `-# Esperamos que tenha gostado da nossa plataforma!`,
                ]

                notifyUser({ userId: application.ownerId, message: {
                    content: notifyContent.join("\n"),
                }}).catch(() => null);

                notifyChannelLog({
                    storeId: (storeConfig._id).toString(),
                    logName: "expiredApplication",
                    message: {
                        content: `A aplicação \`${application.name}\` (ID: ${application.appId}) do usuário <@${application.ownerId}> expirou e foi deletada.`,
                    }
                }).catch(() => null);
            }else{
                application.status = "grace_period";
                application.expiresAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

                // Vamos desligar a aplicação, o usuário não poderá ligar novamente até renovar o plano.
                sdk.instance.stopApplication({appId: application.appId!}).catch(() => null);
                
                const notifyContent = [
                    `# Aviso importante sobre sua aplicação!`,
                    `Olá <@${application.ownerId}>, sua aplicação expirou!\n`,
                    `- Você tem um período de carência de **${GRACE_PERIOD_DAYS} dias** para renová-la.`,
                    `> Após esse período, ela será deletada e não poderá ser recuperada.`,
                    `> Para renovar, entre no servidor ${storeConfig.name} e digite /apps e vá ate a opção de renovar.\n`,
                    `-# Aplicação: ${application.name} - ID ${application.appId}`,
                    `-# Expira em: <t:${Math.floor(application.expiresAt.getTime() / 1000)}:R>`,
                ]

                notifyUser({ userId: application.ownerId, message: {
                    content: notifyContent.join("\n"),
                }}).catch(() => null);

                notifyChannelLog({
                    storeId: (storeConfig._id).toString(),
                    logName: "expiredApplication",
                    message: {
                        content: `A aplicação \`${application.name}\` (ID: ${application.appId}) do usuário <@${application.ownerId}> expirou e entrou no **período de carência**.`,
                    }
                }).catch(() => null);
                await application.save();
            }
        }catch (error: any) {
            console.error(`⚠️ Erro ao processar a expiracao da aplicacao ${application._id}:`, error?.response?.data?.error || error?.message);
        }
    }
})

/** Atualiza os bots pela mesma rotina usada no painel web. */
asyncLoopingExec(5000, async () => {
    const products = await databases.products.find({ needToUpdateApplications: true }, { _id: 1 });
    for (const product of products) {
        await processProductApplicationUpdates(String(product._id)).catch((error) => {
            console.error(`⚠️ Erro ao processar atualizações do produto ${product._id}:`, error);
        });
    }
});