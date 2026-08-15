import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";
import { AttachmentBuilder, ButtonStyle, ChannelType, GuildMemberRoleManager, TextInputStyle } from "discord.js";
import { IProducts } from "../databases/schemas/products";
import { emojis, checkRateLimit, V2Reply } from "../functions";
import { ICoupons } from "../databases/schemas/coupons";
import { notifyUser } from "../functions/notify-wrapper";
import { IStores } from "../databases/schemas/stores";
import { QrCodePix } from 'qrcode-pix';

import databases from "../databases";
import axios from "axios";
import efiWrapper from "../functions/efi_wrapper";
import promisseWrapper from "../functions/promisse_wrapper";
import crypto from "crypto";
import QRCode from "qrcode";
import sdkWrapper from "../functions/camposcloud-sdk";
import fs from "fs/promises";
import { buildHostedBotPackageBuffer, releaseExists, getReleasePath } from "../functions/hosted-bot";

export const CART_EXPIRES_MINUTES = 30;
const PIX_TAX = 1.2;
const DISCORD_API_TIMEOUT_MS = 15_000;

/**
 * Only the buyer who opened the cart may interact with it.
 * Throws so callers can funnel the message through their existing
 * catch-and-reply blocks.
 */
const assertCartAccess = (cart: { userId: string }, userId: string) => {
    if (cart.userId !== userId) {
        throw new Error("Você não tem permissão para interagir com este carrinho.");
    }
};

const assertCartOpen = (cart: { status: string }) => {
    if (cart.status !== "opened") {
        throw new Error("Este carrinho não está mais aberto.");
    }
};

new InteractionHandler({
    customId: "buy-product",

    run: async (client, interaction, storeId, product_id) => {
        try {
            if (!checkRateLimit(`buy:${interaction.user.id}`, { windowMs: 10000, maxRequests: 3 })) {
                return interaction.reply({ content: "`❌`・Você está criando carrinhos muito rápido. Aguarde alguns segundos.", flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });
            await interaction.editReply({ content: `\`🔄\`・Processando sua compra...` });

            const storeConfig = await databases.stores.findOne({ _id: storeId });
            if (!storeConfig) {
                throw new Error("Loja não encontrada. Por favor, contate o administrador do servidor.");
            }

            const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
            if (!ownerStoreConfig) {
                throw new Error("Configuração do dono da loja não encontrada. Por favor, contate o administrador do servidor.");
            }

            if (ownerStoreConfig.payment_gateway === "efi") {
                const efiInstance = await efiWrapper.getInstance(ownerStoreConfig.userId_discord);
                if (!efiInstance || !efiInstance.isValid) {
                    throw new Error("Não foi possível conectar com o gateway de pagamento. Informe um administrador.");
                }
            }

            if (ownerStoreConfig.payment_gateway === "manual") {
                const manual_credentials = ownerStoreConfig.manual_payment_credentials;
                if (!manual_credentials || !manual_credentials.pix_key || !manual_credentials.key_type) {
                    throw new Error("O dono da loja não configurou as credenciais de pagamento manual. Por favor, contate o administrador do servidor.");
                }
            }

            if (ownerStoreConfig.payment_gateway === "promisse") {
                const promisse_credentials = ownerStoreConfig.promissepay_credentials;
                if (!promisse_credentials || !promisse_credentials.api_key) {
                    throw new Error("O dono da loja não configurou as credenciais do PromissePay. Por favor, contate o administrador do servidor.");
                }
            }

            const sdk = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord);
            if (!sdk || !sdk.isValid) {
                throw new Error("Não foi possível verificar a disponibilidade da aplicação. Entre em contato com o suporte.");
            }

            const planUsage = await sdkWrapper.getPlanUsage(ownerStoreConfig.userId_discord);
            if (!planUsage) {
                throw new Error("Não foi possível verificar os recursos disponíveis. Entre em contato com o suporte.");
            }

            if (planUsage.freeMemoryMB < 256) {
                throw new Error("Não há recursos disponíveis para criar uma nova aplicação no momento. Entre em contato com o suporte.");
            }

            if (!product_id) {
                throw new Error("Produto não foi passado por parametro na interação do botão");
            }

            const product = await databases.products.findById(product_id);
            if (!product) {
                throw new Error("Produto não existe mais no banco de dados.");
            }

            const productHasRelease = product.currentReleaseVersion;
            if (!productHasRelease) {
                throw new Error("Este produto não possui uma versão de release definida. Por favor, contate o administrador do servidor.");
            }

            const productInStore = product.storeId.toString() === storeConfig._id.toString();
            if (!productInStore) {
                throw new Error("Este produto não pertence a loja selecionada. Por favor, contate o administrador do servidor.");
            }

            if (!product.prices || (!product.prices.weekly && !product.prices.biweekly && !product.prices.monthly && !product.prices.lifetime)) {
                throw new Error("Este produto não possui preços definidos. Por favor, contate o administrador do servidor.");
            }

            if (interaction.channel?.type !== ChannelType.GuildText) {
                throw new Error("Canal não encontrado para criar o thread.");
            }

            const existOpenedCart = await databases.cartsBuy.findOne({ userId: interaction.user.id, status: { $in: ["opened", "processing"] } });
            if (existOpenedCart) {
                if (interaction.guild?.channels.cache.has(existOpenedCart.channelId)) {
                    return interaction.editReply(V2Reply(
                        `> \`❌\`・Você já possui um carrinho aberto. Por favor, finalize ou cancele o carrinho atual antes de comprar outro produto.`,
                        [
                            CreateRow([
                                CreateButton({ label: "Ir para o carrinho", style: ButtonStyle.Link, url: `https://discord.com/channels/${interaction.guildId}/${existOpenedCart.channelId}`, customId: "" }),
                            ])
                        ]
                    ));
                }

                existOpenedCart.status = "cancelled"; // Cancel the cart if the channel doesn't exist
                await existOpenedCart.save();
            }

            const thread = await interaction.channel.threads.create({
                name: `💱・bot・${interaction.user.id}`,
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Carrinho de compras do usuário ${interaction.user.tag} (${interaction.user.id})`,
            });

            if (!thread) {
                throw new Error("Não foi possível criar o thread privado.");
            }
            await thread.members.add(interaction.user.id);

            // If cart creation fails after the thread already exists, don't leave an orphaned thread behind.
            try {
                await databases.cartsBuy.create({
                    automaticPayment: ownerStoreConfig.payment_gateway !== "manual",
                    channelId: thread.id,
                    storeId: storeConfig._id,
                    userId: interaction.user.id,
                    guildId: interaction.guild?.id,
                    productId: product._id,
                    expiresAt: new Date(Date.now() + CART_EXPIRES_MINUTES * 60 * 1000),
                });
            } catch (err) {
                await thread.delete().catch(() => {});
                throw new Error("Não foi possível criar o carrinho de compras. Tente novamente.");
            }

            const messageData = await getCartMessage(thread.id);
            await thread.send(messageData);

            let mention = `<@${ownerStoreConfig.userId_discord}>`;

            if (storeConfig.permissions && storeConfig.permissions.length > 0) {
                const teamMembers = storeConfig.permissions.map((perm: any) => `<@${perm.userId}>`).join(", ");
                mention += teamMembers;
            }

            const mentionMessage = await thread.send(mention).catch(() => null);
            mentionMessage?.delete().catch(() => {});

            return interaction.editReply({
                content: `\`✅\`・Carrinho criado com sucesso! Você pode continuar a compra no thread privado criado: <#${thread.id}>`,
            });
        } catch (e: any) {
            return interaction.editReply({
                content: `\`❌\`・${e.message}`,
            });
        }
    }
});

new InteractionHandler({
    customId: "select-days",
    run: async (client, interaction) => {
        try {
            if (!interaction.isAnySelectMenu()) {
                return;
            }

            const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId }).populate("productId");
            if (!cart) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }

            assertCartAccess(cart, interaction.user.id);
            assertCartOpen(cart);

            if (cart.step !== "select-days") {
                throw new Error("Esta etapa não está mais disponível para este carrinho.");
            }

            const product = cart.productId as unknown as IProducts;
            if (!product.prices) {
                throw new Error("Este produto não possui preços definidos. Por favor, contate o administrador do servidor.");
            }

            const selectedDays = interaction.values[0];
            let price = 0;

            switch (selectedDays) {
                case "monthly":
                    if (!product.prices.monthly) throw new Error("Preço mensal não definido para este produto.");
                    price = product.prices.monthly;
                    cart.days = 30;
                    break;
                case "biweekly":
                    if (!product.prices.biweekly) throw new Error("Preço quinzenal não definido para este produto.");
                    price = product.prices.biweekly;
                    cart.days = 15;
                    break;
                case "weekly":
                    if (!product.prices.weekly) throw new Error("Preço semanal não definido para este produto.");
                    price = product.prices.weekly;
                    cart.days = 7;
                    break;
                case "lifetime":
                    if (!product.prices.lifetime) throw new Error("Preço vitalício não definido para este produto.");
                    price = product.prices.lifetime;
                    cart.lifetime = true;
                    break;
                default:
                    throw new Error("Opção de dias inválida selecionada.");
            }

            cart.price = price;
            cart.step = "select-coupons";
            await cart.save();

            const messageData = await getCartMessage(cart.channelId);
            await interaction.update(messageData);

        } catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }
    }
});

new InteractionHandler({
    customId: "cupom-step",
    run: async (client, interaction) => {
        try {
            if (!interaction.isButton()) {
                return;
            }

            const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId });
            if (!cart) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }

            assertCartAccess(cart, interaction.user.id);
            assertCartOpen(cart);

            cart.step = "select-coupons";
            await cart.save();

            const messageData = await getCartMessage(cart.channelId);
            await interaction.update(messageData);

        } catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }
    }
});

new InteractionHandler({
    customId: "cancel-cart",
    run: async (_client, interaction) => {
        try {
            await interaction.deferReply({ flags: 64 });
            const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId });

            if (!cart) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }

            assertCartAccess(cart, interaction.user.id);

            if (cart.status !== "opened") {
                throw new Error("Você só pode cancelar carrinhos que estão abertos. Peça pra um administrador excluir o carrinho.");
            }

            await databases.cartsBuy.updateOne({ channelId: interaction.channelId }, { status: "cancelled" });
            await interaction.editReply({ content: "`✅`・Seu carrinho será excluido em 3 segundos." });

            setTimeout(async () => {
                interaction.channel?.delete().catch(() => {});
            }, 3000);

        } catch (error: any) {
            await interaction.editReply({ content: `\`❌\`・${error.message}` });
        }
    }
});

new InteractionHandler({
    customId: "update-cart",
    run: async (client, interaction) => {
        try {
            if (!interaction.isButton()) {
                return;
            }

            const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId });
            if (!cart) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }

            assertCartAccess(cart, interaction.user.id);

            const messageData = await getCartMessage(cart.channelId);
            await interaction.update(messageData);

        } catch (error: any) {
            await interaction.reply({ content: `\`❌\`・${error.message}`, flags: 64 });
        }
    }
});

new InteractionHandler({
    customId: "add-coupon",

    run: async (client, interaction, action) => {
        const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId });
        if (!cart) {
            return interaction.reply({ content: "`❌`・Carrinho não encontrado. Peça pra um administrador excluir pra você.", flags: 64 });
        }

        try {
            assertCartAccess(cart, interaction.user.id);
        } catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            try {
                assertCartOpen(cart);

                const modal = CreateModal({
                    customId: "add-coupon:submit-modal",
                    title: "Adicionar Cupom",
                    inputs: [
                        { customId: "coupon-code", label: "Código do Cupom", style: TextInputStyle.Short, required: true, placeholder: "Digite o código do cupom" }
                    ]
                });

                interaction.showModal(modal);
            } catch (e: any) {
                return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
            }
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                if (!checkRateLimit(`coupon:${interaction.user.id}`, { windowMs: 10000, maxRequests: 5 })) {
                    throw new Error("Você está tentando cupons muito rápido. Aguarde alguns segundos.");
                }

                assertCartOpen(cart);

                const couponCode = interaction.fields.getTextInputValue("coupon-code").trim();
                if (!couponCode) {
                    throw new Error("Você precisa fornecer um código de cupom.");
                }

                const coupon = await databases.coupons.findOne({ code: couponCode });
                if (!coupon) {
                    throw new Error("Cupom inválido ou não encontrado.");
                }

                if (coupon.remainingUses <= 0) {
                    throw new Error("Este cupom não possui mais usos disponíveis.");
                }

                if (coupon.expiresAt && coupon.expiresAt < new Date()) {
                    throw new Error("Este cupom expirou.");
                }

                if (coupon.roles && coupon.roles.length > 0) {
                    const userRoles = interaction.member?.roles as unknown as GuildMemberRoleManager | undefined;
                    const hasRole = userRoles?.cache.some(role => coupon.roles?.includes(role.id)) ?? false;

                    if (!hasRole) {
                        const rolesMention = coupon.roles.map(role => `<@&${role}>`).join(", ");
                        throw new Error(`Esse cupom só pode ser utilizado por membros com os cargos: ${rolesMention}`);
                    }
                }

                if (coupon.products) {
                    if (!coupon.products.includes(cart.productId.toString()) && !coupon.products.includes("all")) {
                        throw new Error("Este cupom não é válido para o produto selecionado.");
                    }
                }

                // BUG CORRIGIDO: o `remainingUses <= 0` era checado acima e o decremento
                // era feito depois com um `updateOne` separado — entre esses dois passos
                // duas submissões simultâneas (ex: usuário clicando 2x, ou 2 usuários com
                // o mesmo cupom no último uso) podiam ambas passar na checagem e ambas
                // decrementar, deixando `remainingUses` negativo (cupom usado a mais do
                // que o permitido). Agora o decremento é atômico e condicional: só
                // consome o uso se `remainingUses > 0` no momento exato do update.
                const claimedCoupon = await databases.coupons.findOneAndUpdate(
                    { code: couponCode, remainingUses: { $gt: 0 } },
                    { $inc: { remainingUses: -1 } }
                );

                if (!claimedCoupon) {
                    throw new Error("Este cupom acabou de esgotar. Tente novamente com outro cupom.");
                }

                cart.coupon = coupon._id as any;
                await cart.save();

                const messageData = await getCartMessage(cart.channelId);
                await interaction.message?.edit(messageData);

                return interaction.reply({ content: "`✅`・Cupom aplicado com sucesso!", flags: 64 });
            } catch (e: any) {
                return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
            }
        }
    }
});

new InteractionHandler({
    customId: "go-payment",

    run: async (client, interaction) => {
        try {
            if (!interaction.isButton()) {
                return;
            }

            if (!checkRateLimit(`payment:${interaction.user.id}`, { windowMs: 10000, maxRequests: 2 })) {
                return interaction.reply({ content: "`❌`・Aguarde alguns segundos antes de gerar outro pagamento.", flags: 64 });
            }

            await interaction.update(V2Reply("`🔄`・Gerando pagamento...", []));

            const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId }).populate("productId").populate("coupon").populate("storeId");
            if (!cart) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }

            assertCartAccess(cart, interaction.user.id);
            assertCartOpen(cart);

            // Idempotency guard: if a payment was already generated for this cart,
            // just re-show it instead of creating a duplicate charge.
            if (cart.step === "waiting-payment" && cart.pix_copy_and_paste) {
                const messageData = await getCartMessage(cart.channelId);
                return interaction.editReply(messageData);
            }

            // BUG CORRIGIDO: nada impedia dois cliques quase simultâneos em
            // "Ir para o pagamento" de gerarem DUAS cobranças PIX diferentes pro
            // mesmo carrinho — a checagem de idempotência acima só protege DEPOIS
            // que o pagamento já foi salvo, e entre ler o carrinho e salvar existe
            // uma chamada de rede pra EFI/PromissePay no meio (janela de corrida).
            // Agora a transição de step é reivindicada atomicamente: só quem
            // conseguir o "lock" segue em frente; quem perder vê a cobrança que
            // já está sendo gerada pela primeira requisição.
            const claimedCart = await databases.cartsBuy.findOneAndUpdate(
                { _id: cart._id, status: "opened", step: { $ne: "waiting-payment" } },
                { $set: { step: "waiting-payment" } },
                { new: true }
            );

            if (!claimedCart) {
                const messageData = await getCartMessage(cart.channelId);
                return interaction.editReply(messageData);
            }

            const storeConfig = cart.storeId as unknown as IStores;
            if (!storeConfig) {
                throw new Error("Loja não encontrada. Por favor, contate o administrador do servidor.");
            }

            const storeOwnerDatabase = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
            if (!storeOwnerDatabase) {
                throw new Error("Configuração do dono da loja não encontrada. Por favor, contate o administrador do servidor.");
            }

            const coupon = cart.coupon ? cart.coupon as unknown as ICoupons : null;

            const coupomDiscount = (cart.coupon ? coupon?.discount : 0) || 0;
            const priceWithDiscount = cart.price - (cart.price * (coupomDiscount / 100));

            if (priceWithDiscount <= 0) {
                throw new Error("O preço total da compra é inválido. Verifique os preços dos produtos e adicione um cupom válido.");
            }

            cart.step = "waiting-payment";
            cart.finalPrice = priceWithDiscount / (1 - (PIX_TAX / 100));

            if (storeOwnerDatabase.payment_gateway === "efi") {
                const efiInstance = await efiWrapper.getInstance(storeOwnerDatabase.userId_discord);
                if (!efiInstance) {
                    throw new Error("Não foi possível possível gerar um pagamento. Informe um administrador.");
                }

                const txid = crypto.randomBytes(16).toString("hex").slice(0, 26);
                const payment = await efiInstance.instance.pixCreateCharge({ txid }, {
                    calendario: {
                        expiracao: 3600,
                    },
                    valor: {
                        original: cart.finalPrice.toFixed(2),
                    },
                    chave: storeOwnerDatabase.efi_credentials?.pix_key!
                }).catch((e: any) => console.error(e));

                if (!payment) {
                    throw new Error("Não foi possível gerar o pagamento. Informe um administrador.");
                }

                const qrCodeDataURL = await QRCode.toDataURL(payment.pixCopiaECola, { errorCorrectionLevel: 'M' });
                const base64Data = qrCodeDataURL.split(',')[1];

                cart.pix_qrcode = base64Data;
                cart.pix_copy_and_paste = payment.pixCopiaECola;
                cart.paymentId = payment.txid;
                await cart.save();

            } else if (storeOwnerDatabase.payment_gateway === "manual") {

                const manual_credentials = storeOwnerDatabase.manual_payment_credentials;
                if (!manual_credentials || !manual_credentials.pix_key || !manual_credentials.key_type) {
                    throw new Error("O dono da loja não configurou as credenciais de pagamento manual. Por favor, contate o administrador do servidor.");
                }

                const qrcode_id = Math.random().toString(36).substring(2, 15);

                const qrCodePix = QrCodePix({
                    version: '01',
                    key: manual_credentials.pix_key,
                    name: 'CamposCloud',
                    city: 'SAO PAULO',
                    transactionId: qrcode_id,
                    message: `Pagamento do bot ${cart._id}`,
                    value: cart.finalPrice,
                });

                const qrCodeDataURL = await qrCodePix.base64();
                const base64Data = qrCodeDataURL.split(',')[1];

                cart.pix_qrcode = base64Data;
                cart.pix_copy_and_paste = qrCodePix.payload();
                await cart.save();
            } else if (storeOwnerDatabase.payment_gateway === "promisse") {

                const promisseCredentials = storeOwnerDatabase.promissepay_credentials;
                if (!promisseCredentials || !promisseCredentials.api_key) {
                    throw new Error("O dono da loja não configurou as credenciais do PromissePay. Por favor, contate o administrador do servidor.");
                }

                const amountInCents = Math.round(cart.finalPrice * 100);
                const transaction = await promisseWrapper.createTransaction(promisseCredentials.api_key, amountInCents);
                if (!transaction) {
                    throw new Error("Não foi possível gerar o pagamento via PromissePay. Informe um administrador.");
                }

                cart.pix_qrcode = transaction.qrCodeBase64;
                cart.pix_copy_and_paste = transaction.copyPaste;
                cart.paymentId = transaction.id;
                await cart.save();
            } else {
                throw new Error("O dono da loja não configurou o gateway de pagamento. Por favor, contate o administrador do servidor.");
            }

            const messageData = await getCartMessage(cart.channelId);
            await interaction.editReply(messageData);

            await interaction.followUp({ content: "`✅`・Pagamento gerado com sucesso!", flags: 64 });
        } catch (e: any) {
            return interaction.editReply({ content: `\`❌\`・${e.message}` });
        }
    }
});

new InteractionHandler({
    customId: "send-bot",

    run: async (client, interaction, action) => {
        if (!checkRateLimit(`send-bot:${interaction.user.id}`, { windowMs: 10000, maxRequests: 3 })) {
            return interaction.reply({ content: "`❌`・Você está enviando bots muito rápido. Aguarde alguns segundos.", flags: 64 });
        }

        const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId }).populate("productId").populate("storeId");
        if (!cart) {
            return interaction.reply({ content: "`❌`・Carrinho não encontrado. Peça pra um administrador excluir pra você.", flags: 64 });
        }

        try {
            assertCartAccess(cart, interaction.user.id);
        } catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }

        if (cart.status !== "opened") {
            return interaction.reply({ content: "`❌`・Você só pode enviar o bot quando o carrinho estiver aberto.", flags: 64 });
        }

        if (cart.step !== "payment-confirmed") {
            return interaction.reply({ content: "`❌`・Você só pode enviar o bot quando o pagamento estiver confirmado. Peça pra um administrador excluir o carrinho.", flags: 64 });
        }

        const product = cart.productId as unknown as IProducts;
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado. Peça pra um administrador excluir o carrinho.", flags: 64 });
        }

        const storeConfig = cart.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada. Peça pra um administrador excluir o carrinho.", flags: 64 });
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
        if (!ownerStoreConfig) {
            return interaction.reply({ content: "`❌`・Configuração do dono da loja não encontrada. Peça pra um administrador excluir o carrinho.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            const modal = CreateModal({
                customId: "send-bot:submit-modal",
                title: "Enviar Bot",
                inputs: [
                    { customId: "bot-name", label: "Nome do Bot", style: TextInputStyle.Short, required: true, placeholder: "Digite o nome do bot" },
                    { customId: "bot-token", label: "Token do Bot", style: TextInputStyle.Short, required: true, placeholder: "Digite o token do bot" },
                    { customId: "bot-server", label: "ID do Servidor Discord (opcional)", style: TextInputStyle.Short, required: false, placeholder: "Ex: 123456789012345678" }
                ]
            });

            await interaction.showModal(modal);
            return;
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            // Defer immediately: every reply below must go through editReply.
            await interaction.deferReply({ flags: 64 });

            const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord);
            if (!sdkCampos?.isValid) {
                return interaction.editReply({ content: "`❌`・Não foi possível conectar com o SDK. Informe um administrador." });
            }

            const requiredMemoryMB = product.memoryMB || 256;
            const latestPlanUsage = await sdkWrapper.getPlanUsage(ownerStoreConfig.userId_discord);
            if (!latestPlanUsage || latestPlanUsage.freeMemoryMB < requiredMemoryMB) {
                return interaction.editReply({ content: "`❌`・Não há recursos disponíveis para criar uma nova aplicação no momento. Entre em contato com o suporte." });
            }

            const existZip = await releaseExists(product._id.toString(), product.currentReleaseVersion!).catch(() => false);
            if (!existZip) {
                return interaction.editReply({ content: "`❌`・Arquivo do bot não encontrado. Relate isso para um administrador." });
            }

            const botToken = interaction.fields.getTextInputValue("bot-token").trim();
            const botName = interaction.fields.getTextInputValue("bot-name").trim();
            const manualServerId = interaction.fields.getTextInputValue("bot-server").trim();

            if (!botToken || !botName) {
                return interaction.editReply({ content: "`❌`・Você precisa fornecer o nome e o token do bot." });
            }

            if (botName.length > 25) {
                return interaction.editReply({ content: "`❌`・O nome do bot não pode ter mais que 25 caracteres." });
            }

            const botInfo = await axios.get(`https://discord.com/api/v10/applications/@me`, {
                headers: { Authorization: `Bot ${botToken}` },
                timeout: DISCORD_API_TIMEOUT_MS,
            }).catch(() => null);

            if (!botInfo || !botInfo.data) {
                return interaction.editReply({ content: "`❌`・O token fornecido não é válido ou não corresponde a um bot existente." });
            }

            let detectedServerId = manualServerId || storeConfig.teamId_campos || "";

            if (!manualServerId) {
                const botGuilds = await axios.get(`https://discord.com/api/v10/users/@me/guilds`, {
                    headers: { Authorization: `Bot ${botToken}` },
                    timeout: DISCORD_API_TIMEOUT_MS,
                }).catch(() => null);

                if (botGuilds?.data?.length === 1) {
                    detectedServerId = botGuilds.data[0].id;
                } else if (botGuilds?.data?.length && storeConfig.teamId_campos) {
                    const match = botGuilds.data.find((g: any) => g.id === storeConfig.teamId_campos);
                    if (match) detectedServerId = match.id;
                }
            }

            // Atomically claim the cart so two near-simultaneous submissions can't both proceed.
            const lockedCart = await databases.cartsBuy.findOneAndUpdate(
                { channelId: interaction.channelId, status: "opened" },
                { status: "processing" },
                { new: true }
            );

            if (!lockedCart) {
                return interaction.editReply({ content: "`❌`・Este carrinho já está sendo processado ou não está mais aberto." });
            }

            let application;
            let uploadedApplication;

            try {
                await interaction.editReply({ content: "Preparando os arquivos da aplicação..." });

                application = await databases.applications.create({
                    storeId: storeConfig._id,
                    productId: product._id,
                    name: botName,
                    ownerId: interaction.user.id,
                    botId: botInfo.data.id,
                    token: botToken,
                    serverId: detectedServerId,
                    expiresAt: lockedCart.lifetime ? null : new Date(Date.now() + (lockedCart.days!) * 24 * 60 * 60 * 1000),
                    version: product.currentReleaseVersion,
                    lifetime: lockedCart.lifetime || false,
                });

                const releasePath = getReleasePath(product._id.toString(), product.currentReleaseVersion!);
                const uploadBuffer = await buildHostedBotPackageBuffer(releasePath, {
                    botID: botInfo.data.id,
                    botToken,
                    apiURL: "https://api.droxbot.com.br",
                    version: product.currentReleaseVersion,
                    syncEmojis: true,
                    saveConfig: false,
                    startOnBackup: true,
                    bot: {
                        token: botToken,
                        owner: interaction.user.id,
                        id: botInfo.data.id,
                        perms: interaction.user.id,
                        server: detectedServerId,
                    }
                });

                await interaction.editReply({
                    content: "Preparando sua aplicação. Aguarde; o limite é de 3 minutos...",
                });

                uploadedApplication = await sdkCampos.instance.createApplication({
                    appName: `${product.name}・${lockedCart.userId}`,
                    memoryMB: product.memoryMB || 256,
                    mainFile: "N/A",
                    runtimeEnvironment: (product.runtimeEnvironment?.toLowerCase().includes("node") ? "nodejs" : "python") as "python" | "nodejs",
                    autoRestartEnabled: true,
                    teamId: storeConfig.teamId_campos || undefined,
                    startupCommand: product.runCommand,
                    file: uploadBuffer,
                    environmentVariables: [
                        { key: "BOT_TOKEN", value: botToken },
                        { key: "BOT_TOKEN_DISCORD", value: botToken },
                        { key: "TOKEN", value: botToken },
                        { key: "DISCORD_TOKEN", value: botToken },
                        { key: "OWNER_ID", value: interaction.user.id },
                        { key: "APPLICATION_ID", value: String(application._id) },
                        { key: "BOT_ID", value: botInfo.data.id },
                        { key: "API_URL", value: "https://api.droxbot.com.br" },
                        { key: "VERSION", value: String(product.currentReleaseVersion) },
                        { key: "DROX_EMOJIS", value: "true" },
                        { key: "SAVE_CONFIG", value: "false" },
                        { key: "START_ON_BACKUP", value: "true" },
                        { key: "SERVER_ID", value: detectedServerId },
                        { key: "PERMS", value: interaction.user.id },
                    ]
                });

                application.appId = uploadedApplication.data._id;
                await application.save();

                lockedCart.status = "closed";
                lockedCart.delivered = true;
                await lockedCart.save();

                const notifyContent = [
                    `# Bot enviado com sucesso! 🎉`,
                    `- Olá <@${interaction.user.id}>, seu bot foi enviado com sucesso!\n`,
                    `> Você pode ver mais detalhes usando o comando /apps na loja ${storeConfig.name}.\n`,
                    `-# ${product.name} - ID ${application._id}`
                ];

                notifyUser({ userId: interaction.user.id, message: notifyContent.join("\n") });

                await interaction.editReply({ content: "`✅`・Bot enviado com sucesso! Você pode ver mais detalhes usando o comando /apps. Esse carrinho será fechado em 5 segundos" });
                setTimeout(() => {
                    interaction.channel?.delete().catch(() => {});
                }, 5000);

            } catch (e: any) {
                if (application) {
                    await databases.applications.deleteOne({ _id: application._id });
                }

                if (uploadedApplication) {
                    await sdkCampos.instance.deleteApplication({ appId: uploadedApplication.data._id }).catch(() => {});
                }

                console.error("[BUY] Falha ao hospedar aplicação:", axios.isAxiosError(e)
                    ? { status: e.response?.status, code: e.code, message: e.message }
                    : e instanceof Error ? { name: e.name, message: e.message } : "Erro desconhecido");

                // Release the lock so the buyer can retry instead of being stuck forever.
                lockedCart.status = "opened";
                await lockedCart.save().catch(() => {});

                const apiError = e?.response?.data?.error;
                const errorMessage = e?.code === "ECONNABORTED"
                    ? "A preparação demorou mais de 3 minutos. O carrinho foi liberado; tente novamente."
                    : typeof apiError === "string"
                        ? apiError
                        : e?.message || "Falha desconhecida ao enviar a aplicação.";

                return interaction.editReply({ content: `\`❌\`・${errorMessage}` });
            }
        }
    }
});

export const getCartMessage = async (channelId: string) => {
    const cart = await databases.cartsBuy.findOne({ channelId }).populate("productId").populate("coupon").populate("storeId");
    if (!cart) return V2Reply("Carrinho não encontrado.", []);

    const product = cart.productId as unknown as IProducts;
    const coupon = cart.coupon ? cart.coupon as unknown as ICoupons : null;
    const coupomDiscount = (cart.coupon ? coupon?.discount : 0) || 0;

    const storeConfig = cart.storeId as unknown as IStores;
    if (!storeConfig) {
        throw new Error("Loja não encontrada. Por favor, contate o administrador do servidor.");
    }

    const contents = [];
    const components = [];

    if (cart.step === "select-days") {
        contents.push(
            `# Sistema de Compras`,
            `- Olá <@${cart.userId}>, você está comprando o produto **${product.name}**.`,
            `> Selecione por quantos dias deseja adquirir o produto.\n`
        );

        contents.push(
            `> Seu carrinho expira em <t:${Math.floor(cart.expiresAt.getTime() / 1000)}:R>`,
        );

        const selectDaysOptions = [];
        if (product.prices?.monthly) {
            selectDaysOptions.push({ label: "Mensal・30 dias", value: "monthly", description: `R$ ${product.prices.monthly.toFixed(2)}`, emoji: "📆" });
        }

        if (product.prices?.biweekly) {
            selectDaysOptions.push({ label: "Quinzenal・15 dias", value: "biweekly", description: `R$ ${product.prices.biweekly.toFixed(2)}`, emoji: "📅" });
        }

        if (product.prices?.weekly) {
            selectDaysOptions.push({ label: "Semanal・7 dias", value: "weekly", description: `R$ ${product.prices.weekly.toFixed(2)}`, emoji: "📅" });
        }

        if (product.prices?.lifetime) {
            selectDaysOptions.push({ label: "Vitalício", value: "lifetime", description: `R$ ${product.prices.lifetime.toFixed(2)}`, emoji: "♾️" });
        }

        components.push(
            CreateRow([
                new CreateSelect().StringSelectMenuBuilder({ customId: "select-days", placeholder: "Selecione os dias", options: selectDaysOptions })
            ]),

            CreateRow([
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: "cancel-cart", emoji: emojis.cancel }),
            ])
        );

        return V2Reply(contents.join("\n"), components);
    }

    if (cart.step === "select-coupons") {
        const priceWithDiscount = cart.price - (cart.price * (coupomDiscount / 100));

        contents.push(
            `# Sistema de Compras`,
            `- Olá <@${cart.userId}>, você está comprando o produto **${product.name}**.`,
            `- O preço total da compra é de R$ ${priceWithDiscount.toFixed(2)}.\n`,
        );

        if (coupon) {
            contents.push(
                `- Cupom aplicado com sucesso!`,
                `> - Código: **${coupon.code}** ( ${coupomDiscount}% )`,
                `> - Desconto: R$ ${(cart.price * (coupomDiscount / 100)).toFixed(2)}\n`,
            );
        } else {
            contents.push(`- Você pode adicionar um cupom de desconto ou continuar com a compra.`);
        }

        contents.push(
            `> Seu carrinho expira em <t:${Math.floor(cart.expiresAt.getTime() / 1000)}:R>`,
        );

        components.push(
            CreateRow([
                CreateButton({ label: "Ir para o pagamento", style: ButtonStyle.Success, customId: "go-payment", emoji: emojis.cart }),
                CreateButton({ label: "Adicionar cupom", style: ButtonStyle.Primary, customId: "add-coupon:show-modal", emoji: emojis.cupom }),
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: "cancel-cart", emoji: emojis.cancel }),
            ])
        );

        return V2Reply(contents.join("\n"), components);
    }

    if (cart.step === "waiting-payment") {
        const priceWithDiscount = cart.price - (cart.price * (coupomDiscount / 100));

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos });
        if (!ownerStoreConfig) {
            throw new Error("Configuração do dono da loja não encontrada. Por favor, contate o administrador do servidor.");
        }

        const payment_gateway = ownerStoreConfig.payment_gateway;

        contents.push(
            `# Sistema de Compras`,
            `- Olá <@${cart.userId}>, você está comprando o produto **${product.name}**.`,
            `- O preço total da compra é de R$ ${priceWithDiscount.toFixed(2)}.\n`,
            `- Status: **Aguardando pagamento.**`,
            `> Seu carrinho expira em <t:${Math.floor(cart.expiresAt.getTime() / 1000)}:R>\n`,
        );

        if (payment_gateway === "efi" || payment_gateway === "promisse") {
            contents.push(
                `- -# \`⚠️\`・O Pagamento será aprovado automaticamente`,
            );
        }

        if (payment_gateway === "manual") {
            contents.push(
                `- -# \`⚠️\`・Após realizar o pagamento, envie aqui o comprovante para que o administrador aprove seu carrinho.`,
            );
        }

        components.push(
            CreateRow([
                CreateButton({ label: "Pix Copia e Cola", style: ButtonStyle.Primary, customId: "pix-copy-and-paste", emoji: emojis.copy }),
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: "cancel-cart", emoji: emojis.cancel }),
                CreateButton({ label: "Atualizar", style: ButtonStyle.Secondary, customId: "update-cart", emoji: emojis.reload }),
            ])
        );

        const buffer_base_64 = Buffer.from(cart.pix_qrcode!, "base64");
        const attachment = new AttachmentBuilder(buffer_base_64, { name: "payment.png" });

        return V2Reply(contents.join("\n"), components, { files: [attachment] });
    }

    if (cart.step === "payment-confirmed") {
        contents.push(
            `# Pagamento confirmado 🎉`,
            `- Olá <@${cart.userId}>, seu pagamento foi confirmado!\n`,
            `- Pra finalizar a compra, envie seu BOT clicando no botão **"Enviar Bot"** abaixo.`,
            `> Acesse o [Discord Developers](<https://discord.com/developers/applications>) para criar seu BOT e obter o token.`,
            `> Dúvidas sobre como criar um BOT? Abra um ticket que ajudamos você!\nㅤ`,
        );

        components.push(
            CreateRow([
                CreateButton({ label: "Enviar Bot", style: ButtonStyle.Success, customId: "send-bot:show-modal", emoji: emojis.yes }),
                CreateButton({ label: "Video tutorial", style: ButtonStyle.Link, url: "https://www.youtube.com/watch?v=JvuARNPwcXs", customId: "", disabled: true }),
            ])
        );

        return V2Reply(contents.join("\n"), components);
    }

    return V2Reply(
        "`❌`・Etapa inválida.",
        [
            CreateRow([
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: "cancel-cart", emoji: emojis.cancel }),
            ])
        ]
    );
};

new InteractionHandler({
    customId: "pix-copy-and-paste",
    run: async (client, interaction) => {
        try {
            if (!interaction.isButton()) {
                return;
            }

            const cart = await databases.cartsBuy.findOne({ channelId: interaction.channelId });
            if (!cart) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }

            assertCartAccess(cart, interaction.user.id);

            if (!cart.pix_copy_and_paste) {
                throw new Error("Pix Copia e Cola não encontrado. Peça pra um administrador excluir o carrinho.");
            }

            await interaction.reply({ content: `${cart.pix_copy_and_paste}`, flags: 64 });
        } catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }
    }
});
