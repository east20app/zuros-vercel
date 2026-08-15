import client from "./bot-client";
import databases from "./databases";
import efiWrapper from "./functions/efi_wrapper";
import promisseWrapper from "./functions/promisse_wrapper";
import sdkWrapper from "./functions/camposcloud-sdk";

import { asyncLoopingExec } from "./functions";
import { getCartMessage } from "./events/buy.event";
import { changeBalance } from "./functions/extracts";
import { notifyChannelLog, notifyUser } from "./functions/notify-wrapper";
import { IStores } from "./databases/schemas/stores";
import { getCartMessageRenew } from "./commands/apps";
import { InteractionResponse } from "discord.js";
import AdmZip from "adm-zip";
import ignore from "ignore";
import { buildApplicationPackageConfig } from "./integration/apps";
import { buildHostedBotPackageFromBuffer } from "./functions/hosted-bot";
import { readReleaseBuffer } from "./functions/release-storage";

let validPresences = [] as string[];
let currentActivity = 0;

export const renewCartsMessage = new Map<string, InteractionResponse>();

const GRACE_PERIOD_DAYS = 4;
const RATE_UPDATE_APPLICATION_SECONDS = 3;

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
asyncLoopingExec(5000, async () => {
    const buyCarts = await databases.cartsBuy.find({ status: "opened", step: "waiting-payment", automaticPayment: true }).populate("storeId").populate("coupon");

    for (const cart of buyCarts) {
        try {
            const storeConfig = cart.storeId as unknown as IStores;
            if (!storeConfig) {
                console.error(`\`⚠️\`・Carrinho com ID ${cart._id} não possui configuração de loja válida.`);
                continue;
            }

            const storeOwnerConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
            if (!storeOwnerConfig) {
                console.error(`\`⚠️\`・Configuração de loja do dono do carrinho com ID ${cart._id} não encontrada.`);
                continue;
            }

            let paymentApproved = false;

            if (storeOwnerConfig.payment_gateway === "efi") {
                const efiInstance = await efiWrapper.getInstance(storeOwnerConfig.userId_discord);
                if (!efiInstance || !efiInstance.isValid) {
                    console.error(`\`⚠️\`・Não foi possível conectar-se ao gateway EFI para o carrinho com ID ${cart._id}.`);
                    continue;
                }

                const payment_status = await efiInstance.instance.pixDetailCharge({ txid: cart.paymentId! }).catch(() => null);
                if (payment_status?.status === "CONCLUIDA") {
                    paymentApproved = true;
                }
            } else if (storeOwnerConfig.payment_gateway === "promisse") {
                const promisseApiKey = storeOwnerConfig.promissepay_credentials?.api_key;
                if (!promisseApiKey || !cart.paymentId) {
                    continue;
                }

                const transaction = await promisseWrapper.getTransactionStatus(promisseApiKey, cart.paymentId);
                if (transaction?.status === "PAID") {
                    paymentApproved = true;
                }
            }

            if (paymentApproved) {
                // BUG CORRIGIDO: aqui sempre era creditado `cart.price` (preço cheio,
                // pré-desconto). Se o carrinho tivesse um cupom aplicado, a loja era
                // creditada com um valor MAIOR do que o cliente efetivamente pagou —
                // a plataforma estava "bancando" o desconto do cupom do próprio
                // bolso da loja. Agora calculamos o mesmo valor com desconto que é
                // usado em go-payment (buy.event.ts) pra gerar a cobrança.
                const coupon = cart.coupon as unknown as { discount?: number } | null;
                const coupomDiscount = coupon?.discount || 0;
                const amountToCredit = cart.price - (cart.price * (coupomDiscount / 100));

                // Credita o saldo ANTES de marcar o carrinho como confirmado: se `changeBalance`
                // falhar, o carrinho continua em "waiting-payment" e será tentado novamente no
                // próximo tick, em vez de perder o crédito silenciosamente.
                await changeBalance({ action: "add", amount: amountToCredit, origin: "sales", description: `Carrinho pago por ${cart.userId}`, storeId: (storeConfig._id).toString() });
                await databases.cartsBuy.updateOne({ _id: cart._id }, { $set: { step: "payment-confirmed" } });

                const customer_role = storeConfig.logsAndRoles?.customerRole;
                if (customer_role){
                    const member = await client.guilds.cache.get(cart.guildId)?.members.fetch(cart.userId).catch(() => null);
                    member?.roles.add(customer_role).catch(() => null);
                }

                const messageData = await getCartMessage(cart.channelId);
                const channel = client.channels.cache.get(cart.channelId);

                if (!channel || !messageData || !channel.isThread()) continue;
                await channel.bulkDelete(30).catch(() => null);
                await channel.send(messageData).catch(() => null);
            }
        } catch (error) {
            console.error(`⚠️ Erro ao processar o pagamento do carrinho ${cart._id}:`, error);
        }
    };

    /**
     * Esse trecho é responsável por verificar os carrinhos de renovação.
     * Após a conclusão do pagamento, ele atualiza a aplicação e notifica o usuário.
     * 
     * Ele verifica a cada 5 segundos se há carrinhos de renovação abertos com o status "waiting-payment".
     * Se encontrar algum, ele consulta o status do pagamento via efiWrapper e atualiza o carrinho e a aplicação.
     */
    const renewCarts = await databases.cartsRenew.find({ status: "opened", step: "waiting-payment", delivered: false }).populate("storeId");

    for (const cart of renewCarts) {
        try {
            const storeConfig = await databases.stores.findOne({ _id: cart.storeId });
            if (!storeConfig) {
                console.error(`\`⚠️\`・Carrinho de renovação com ID ${cart._id} não possui configuração de loja válida.`);
                continue;
            }

            const storeOwnerConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
            if (!storeOwnerConfig) {
                console.error(`\`⚠️\`・Configuração de loja do dono do carrinho de renovação com ID ${cart._id} não encontrada.`);
                continue;
            }

            let paymentApproved = false;

            if (storeOwnerConfig.payment_gateway === "efi") {
                const efiInstance = await efiWrapper.getInstance(storeOwnerConfig.userId_discord);
                if (!efiInstance || !efiInstance.isValid) {
                    console.error(`\`⚠️\`・Não foi possível conectar-se ao gateway EFI para o carrinho de renovação com ID ${cart._id}.`);
                    continue;
                }

                const payment_status = await efiInstance.instance.pixDetailCharge({ txid: cart.paymentId! }).catch(() => null);
                if (payment_status?.status === "CONCLUIDA") {
                    paymentApproved = true;
                }
            } else if (storeOwnerConfig.payment_gateway === "promisse") {
                const promisseApiKey = storeOwnerConfig.promissepay_credentials?.api_key;
                if (!promisseApiKey || !cart.paymentId) {
                    continue;
                }

                const transaction = await promisseWrapper.getTransactionStatus(promisseApiKey, cart.paymentId);
                if (transaction?.status === "PAID") {
                    paymentApproved = true;
                }
            }

            if (paymentApproved) {
                // Mesmo raciocínio do bloco de compra: credita antes de confirmar, pra não
                // perder o crédito caso algo abaixo falhe.
                await changeBalance({ action: "add", amount: cart.price, origin: "sales", description: `Renovação paga por ${cart.userId}`, storeId: (storeConfig._id).toString() });

                const application = await databases.applications.findOne({ _id: cart.applicationId });
                if (!application) {
                    console.error(`\`⚠️\`・Aplicação para o carrinho de renovação com ID ${cart._id} não encontrada.`);
                    // O saldo já foi creditado - marcamos como confirmado mesmo sem poder
                    // entregar, pra não creditar de novo numa próxima tentativa.
                    await databases.cartsRenew.updateOne({ _id: cart._id }, { $set: { step: "payment-confirmed" } }).catch(() => {});
                    continue;
                }

                /**
                 * Vamos salvar o carrinho como entregue e fechado.
                 */
                cart.delivered = true;
                cart.status = "closed";
                cart.step = "payment-confirmed";
                await cart.save();

                // Vamos atualizar a mensagem do carrinho para dar um feedback de pagamento aprovado.
                const message = renewCartsMessage.get(cart._id.toString());
                if (message){
                    const updatedMessageData = await getCartMessageRenew(cart._id.toString());
                    if (updatedMessageData){
                        await message.edit(updatedMessageData).catch((error) => console.warn("⚠️ Erro ao editar a mensagem do carrinho de renovação:", error));
                    }
                }

                // BUG CORRIGIDO (memory leak): `renewCartsMessage` é um Map de módulo
                // que só recebia entradas e nunca era limpo. Em produção, com o bot
                // rodando por semanas/meses, isso cresce pra sempre. O carrinho já
                // está fechado aqui, então a mensagem não precisa mais ficar em cache.
                renewCartsMessage.delete(cart._id.toString());

                // Se for vitalícia, vamos atualizar a aplicação para vitalícia.
                if (cart.lifetime){

                    application.lifetime = true;
                    await application.save();

                    const notifyContent = [
                        `# Sua aplicação foi renovada com sucesso! 🎉`,
                        `Olá <@${cart.userId}>, sua aplicação **${application.name}** foi renovada com sucesso!\n`,
                        `-# Agora ela é vitalícia e não expirará mais!`,
                        `> Agradecemos por continuar utilizando nossos serviços!`,
                    ];

                    notifyUser({ userId: cart.userId, message: notifyContent.join("\n") }).catch(() => null);
                }else{
                    // Se não for vitalícia, vamos adicionar os dias comprados na aplicação.
                    if (!cart.days){
                        console.error(`\`⚠️\`・Dias inválidos para renovação na aplicação ${application._id}.`);
                        continue;
                    }

                    application.expiresAt = new Date((application.expiresAt || new Date()).getTime() + cart.days * 24 * 60 * 60 * 1000);
                    application.status = "active";
                    await application.save();

                    const notifyContent = [
                        `# Sua aplicação foi renovada com sucesso! 🎉`,
                        `Olá <@${cart.userId}>, sua aplicação **${application.name}** foi renovada com sucesso!\n`,
                        `-# Expira em: <t:${Math.floor((application.expiresAt.getTime()) / 1000)}:R>`,
                        `> Agradecemos por continuar utilizando nossos serviços!`,
                    ];

                    notifyUser({ userId: cart.userId, message: notifyContent.join("\n") }).catch(() => null);
                }
            }
        } catch (error) {
            console.error(`⚠️ Erro ao processar o pagamento do carrinho de renovação ${cart._id}:`, error);
        }
    };
});


/**
 * Esse cronjob é responsável por verificar se os carrinhos expiraram.
 * Após expirar, eles são fechados na DB e o thread é deletado.
 */
asyncLoopingExec(5000, async () => {
    const buyCarts = await databases.cartsBuy.find({ status: "opened", step: { $ne: "payment-confirmed" }, expiresAt: { $lte: new Date() } });

    for (const cart of buyCarts) {
        try {
            await databases.cartsBuy.updateOne({ _id: cart._id }, { $set: { status: "expired" } });
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
            await databases.cartsRenew.updateOne({ _id: cart._id }, { $set: { status: "expired" } });

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

/**
 * Esse cronjob é responsável por atualizar os BOTs para a release atual.
 */
asyncLoopingExec(5000, async () => {
    const stores = await databases.stores.find({});

    // Executa lojas em paralelo
    await Promise.all(stores.map(async (store) => {
        try {
            const productsOnStore = await databases.products.find({ storeId: store._id, needToUpdateApplications: true });

            const storeOwnerConfig = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
            if (!storeOwnerConfig) {
                // console.error(`⚠️ Configuração de loja do dono da loja ${store._id} não encontrada.`);
                return;
            }

            const sdk = await sdkWrapper.getInstance(storeOwnerConfig.userId_discord).catch(() => null);
            if (!sdk || !sdk.isValid) {
                // console.error(`⚠️ Não foi possível conectar-se ao SDK para a loja ${store._id}.`);
                return;
            }

            // Aqui executa produtos em série
            for (const product of productsOnStore) {
                try {
                    if (!product.currentReleaseVersion){
                        console.error(`⚠️ Release atual do produto ${product._id} não encontrada.`);
                        await databases.products.updateOne({ _id: product._id }, { $set: { needToUpdateApplications: false } });
                        continue;
                    }

                    const applications = await databases.applications.find({
                        productId: product._id,
                        errorOnUpdate: false,
                        version: { $ne: product.currentReleaseVersion }
                    });

                    if (!applications.length){
                        await databases.products.updateOne({ _id: product._id }, { $set: { needToUpdateApplications: false } });
                        // FIX: isto era `return`, que encerrava o processamento de TODOS os
                        // produtos restantes desta loja assim que um único produto não tinha
                        // aplicações pendentes. Deve apenas pular para o próximo produto.
                        continue;
                    }

                    const productId = String(product._id);
                    const version = String(product.currentReleaseVersion);
                    const legacyPath = `releases/${productId}/${version}.zip`;
                    const storedRelease = await readReleaseBuffer(productId, version, legacyPath).catch(() => null);
                    if (!storedRelease) {
                        console.error(`⚠️ Release ${product.currentReleaseVersion} do produto ${product._id} não encontrada.`);
                        // Não encerra a fila em uma indisponibilidade temporária. Se a flag
                        // fosse limpa aqui, as aplicações permaneceriam pendentes para sempre.
                        continue;
                    }

                    const zipFile = new AdmZip(storedRelease);
                    const zipEntries = zipFile.getEntries();
                    const ig = ignore().add(product.protectedFiles || []);

                    zipEntries.forEach((entry) => {
                        if (ig.ignores(entry.entryName)) {
                            console.log(`🛡️ Arquivo protegido, não será extraído: ${entry.entryName}`);
                            zipFile.deleteFile(entry.entryName);
                        }
                    });

                    // BUG CORRIGIDO (perf): `zipFile.toBuffer()` estava sendo chamado
                    // dentro do loop de aplicações — ele serializa o zip inteiro do
                    // zero a cada chamada, mesmo que o conteúdo seja idêntico pra
                    // todas as apps deste produto. Serializa uma vez só.
                    const releaseBuffer = zipFile.toBuffer();

                    // Aqui também já é sequencial
                    for (const app of applications) {
                        let success = false;
                        let attempts = app.updateAttempts || 0;

                        while (!success && attempts <= 3) {
                            const initialTime = Date.now();

                            try {
                                if (!app.appId) throw new Error("Aplicação sem appId.");

                                const appCampos = await sdk.instance.getApplication({ appId: app.appId }).catch(() => null);
                                if (!appCampos) throw new Error("Aplicação não encontrada no CamposCloud.");

                                if (appCampos.data.currentResourceMetrics.online) {
                                    await appCampos.stop().catch(() => null);
                                }

                                const zipBuffer = buildHostedBotPackageFromBuffer(
                                    releaseBuffer,
                                    buildApplicationPackageConfig({
                                        token: app.token,
                                        ownerId: app.ownerId,
                                        applicationId: String(app._id),
                                        botId: app.botId,
                                        version: product.currentReleaseVersion,
                                        serverId: app.serverId,
                                    })
                                );
                                await appCampos.uploadFile({ file: zipBuffer, path: "/" });
                                await appCampos.start().catch(() => null);

                                await databases.applications.updateOne(
                                    { _id: app._id }, 
                                    { $set: { version: product.currentReleaseVersion } }
                                );

                                console.log(`✅ Aplicação ${app._id} atualizada para a versão ${product.currentReleaseVersion}.`);
                                success = true;
                            } catch (error: any) {
                                attempts++;

                                if (attempts > 3) {
                                    console.error(`⚠️ Erro ao atualizar a aplicação ${app._id} após 3 tentativas, aplicação marcada como erro ao atualizar.`, error);

                                    await databases.applications.updateOne(
                                        { _id: app._id }, 
                                        { 
                                            $set: { errorOnUpdate: true, errorOnUpdateMessage: error?.message || "Erro desconhecido" },
                                        }
                                    );
                                }else{
                                    console.log(`⚠️ Tentativa ${attempts} de 3 para atualizar a aplicação ${app._id}.`);

                                    await databases.applications.updateOne(
                                        { _id: app._id }, 
                                        { $set: { updateAttempts: attempts } }
                                    );
                                }

                            } finally {

                                const elapsedTime = Date.now() - initialTime;
                                const remainingTime = (RATE_UPDATE_APPLICATION_SECONDS * 1000) - elapsedTime;

                                if (remainingTime > 0) {
                                    console.log(`Aguardando ${Math.ceil(remainingTime / 1000)} segundos...`);
                                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                                }else{
                                    console.log(`Continuando sem aguardar, tempo de atualização já excedido. Tempo gasto: ${Math.ceil(elapsedTime / 1000)} segundos.`);
                                }
                            }
                        }
                    }
                } catch (productError) {
                    console.error(`⚠️ Erro ao processar atualizações do produto ${product._id}:`, productError);
                }
            }
        } catch (storeError) {
            console.error(`⚠️ Erro ao processar atualizações da loja ${store._id}:`, storeError);
        }
    }));
});
