import databases from "@root/src/databases";
import { IStores } from "@root/src/databases/schemas/stores";
import { getCartMessage } from "@root/src/events/buy.event";
import { getUserHasPermissionOnStore, PermissionsStore } from "@root/src/functions";
import { changeBalance } from "@root/src/functions/extracts";
import { renewCartsMessage } from "@root/src/cronjobs";
import { getCartMessageRenew } from "@root/src/commands/apps";
import { TextInputStyle } from "discord.js";
import { CreateModal, InteractionHandler, SlashCommand } from "fast-discord-js";

new SlashCommand({
    name: "aprovar",
    description: "Aprovar carrinho do usuário",
    type: 1,

    run: async (client, interaction) => {
        client.invokeInteraction("approve-payment:show-modal", interaction as any);
    }
})

new InteractionHandler({
    customId: "approve-payment",

    run: async (client, interaction, action) => {

        if (!interaction.channel?.isThread()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado em canais de texto.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isCommand()){
            const modal = CreateModal({ 
                title: "Aprovar Carrinho",
                customId: "approve-payment:submit-modal",
                inputs: [
                    { customId: "add-balance", label: "Essa compra deve ser adicionada no saldo ?", placeholder: "Use: sim ou não", style: TextInputStyle.Short, required: true },
                ]
            })

            return await modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){

            const validValues = ["sim", "não"];

            const confirm = interaction.fields.getTextInputValue("add-balance").trim();
            if (!validValues.includes(confirm.toLowerCase())){
                return interaction.reply({ content: "`❌`・Valor inválido, use: `sim` ou `não`", flags: 64 });
            }

            const buyCart = await databases.cartsBuy.findOne({ channelId: interaction.channelId }).populate("storeId");
            const renewCartEntry = buyCart
                ? undefined
                : [...renewCartsMessage.entries()].find(([, message]) => message.interaction.channelId === interaction.channelId);
            const renewCart = buyCart
                ? null
                : await databases.cartsRenew.findOne({
                    $or: [
                        { channelId: interaction.channelId },
                        ...(renewCartEntry ? [{ _id: renewCartEntry[0] }] : []),
                    ],
                    status: { $in: ["opened", "processing"] },
                }).populate("storeId").populate("applicationId");

            if (buyCart) {
                const storeConfig = buyCart.storeId as unknown as IStores;
                if (!storeConfig){
                    return interaction.reply({ content: "`❌`・A loja deste carrinho está desativada ou não existe mais.", flags: 64 });
                }

                const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
                if (!hasPermission) {
                    return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
                }
                
                if (buyCart.step !== "waiting-payment"){
                    return interaction.reply({ content: "`❌`・Para aprovar o carrinho, ele deve estar no passo de pagamento.", flags: 64 });
                }

                if (confirm.toLowerCase() === "sim"){
                    await changeBalance({ 
                        action: "add", 
                        amount: buyCart.price, 
                        origin: "sales", 
                        description: `Carrinho aprovado por ${interaction.user.tag} (${interaction.user.id})`,
                        storeId: storeConfig._id.toString(),
                    });
                }

                const customer_role = storeConfig.logsAndRoles?.customerRole;
                if (customer_role){
                    const member = await client.guilds.cache.get(buyCart.guildId)?.members.fetch(buyCart.userId).catch(() => null);
                    member?.roles.add(customer_role).catch(() => null);
                }

                buyCart.status = "opened";
                buyCart.step = "payment-confirmed";
                await buyCart.save();

                const messageData = await getCartMessage(interaction.channel.id);
                if (!messageData) {
                    return interaction.reply({ content: "`❌`・Erro ao buscar a mensagem do carrinho.", flags: 64 });
                }

                await interaction.channel.bulkDelete(100, true).catch(() => {});
                await interaction.channel.send(messageData);

                return interaction.reply({ content: "`✅`・Carrinho aprovado e mensagem enviada.", flags: 64 });
            }

            if (renewCart) {
                const storeConfig = renewCart.storeId as unknown as IStores;
                if (!storeConfig){
                    return interaction.reply({ content: "`❌`・A loja deste carrinho está desativada ou não existe mais.", flags: 64 });
                }

                const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
                if (!hasPermission) {
                    return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
                }

                if (renewCart.step !== "waiting-payment"){
                    return interaction.reply({ content: "`❌`・Para aprovar o carrinho, ele deve estar no passo de pagamento.", flags: 64 });
                }

                if (confirm.toLowerCase() === "sim"){
                    await changeBalance({ 
                        action: "add", 
                        amount: renewCart.price, 
                        origin: "sales", 
                        description: `Renovação aprovada por ${interaction.user.tag} (${interaction.user.id})`,
                        storeId: storeConfig._id.toString(),
                    });
                }

                renewCart.delivered = true;
                renewCart.status = "closed";
                renewCart.step = "payment-confirmed";
                await renewCart.save();

                const application = await databases.applications.findById(renewCart.applicationId);
                if (application) {
                    if (renewCart.lifetime) {
                        application.lifetime = true;
                    } else if (renewCart.days) {
                        application.expiresAt = new Date((application.expiresAt || new Date()).getTime() + renewCart.days * 24 * 60 * 60 * 1000);
                        application.status = "active";
                    }
                    await application.save();
                }

                const message = renewCartsMessage.get(renewCart._id.toString());
                if (message) {
                    const updatedMessageData = await getCartMessageRenew(renewCart._id.toString());
                    if (updatedMessageData) {
                        await message.edit(updatedMessageData).catch(() => null);
                    }
                }

                return interaction.reply({ content: "`✅`・Renovação aprovada com sucesso.", flags: 64 });
            }

            return interaction.reply({ content: "`❌`・Nenhum carrinho encontrado para este canal.", flags: 64 });
        }
    }
})
