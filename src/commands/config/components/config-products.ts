import client from "@root/src/bot-client";
import databases from "@root/src/databases";
import fs from "fs/promises";

import { emojis, getUserHasPermissionOnStore, moneyFormatter, PermissionsStore, V2Reply } from "@root/src/functions";
import { AttachmentBuilder, ChannelType, PermissionsBitField, TextInputStyle } from "discord.js";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";
import bytes from "bytes";
import AdmZip from "adm-zip";
import PageSystem from "@root/src/functions/pages";
import ignore from "ignore";

const VALID_RUNTIMES = ["nodejs", "python", "java", "go", "rust", "dotnet", "deno"];

new InteractionHandler({ 
    customId: "config-products",

    run: async (_client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const products = await databases.products.find({ storeId: storeId }).catch(() => []);
        const contents = [
            `# Configurando produtos`,
            `- Aqui você poderá adicionar, remover e editar produtos!\n`,
        ]

        const components = [
            CreateRow([
                CreateButton({ label: "Adicionar Produto", style: 1, customId: `add-product:${storeId}:show-modal`, emoji: emojis.add}),
                CreateButton({ label: "Atualizar Painel", style: 2, customId: `config-products:${storeId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: `config-store:${storeId}`, emoji: emojis.back})
            ])
        ]

        if (products.length){
            components.unshift(CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `select-edit-product:${storeId}`,
                    options: products.map((product: any) => ({ label: `Produto: ${product.name}`, value: product._id, emoji: emojis.settings, description: "Clique para editar esse produto" })),
                    placeholder: "Selecione um produto",
                })
            ]))
        }

        await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] })
    }
})

new InteractionHandler({ 
    customId: "add-product",

    run: async (_client, interaction, storeId, action) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal"){

            const modal = CreateModal({
                customId: `add-product:${storeId}:submit-modal`,
                title: "Adicionando produto",
                inputs: [
                    { label: "Nome do produto", placeholder: "Digite o nome do produto", required: true, style: TextInputStyle.Short, customId: "name" },
                    { label: "Ambiente de execução", placeholder: "nodejs, python, java, go, rust, dotnet, deno", required: true, style: TextInputStyle.Short, customId: "runtimeEnvironment" },
                    { label: "Comando de execução", placeholder: "node index.js, python main.py", required: true, style: TextInputStyle.Short, customId: "runCommand" },
                ]
            })

            return modal.show(interaction as any);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){

            const name = interaction.fields.getTextInputValue("name");
            const runtimeEnvironment = interaction.fields.getTextInputValue("runtimeEnvironment");
            const runCommand = interaction.fields.getTextInputValue("runCommand");

            if (!name){
                return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });
            }

            if (!VALID_RUNTIMES.includes(runtimeEnvironment)){
                return await interaction.reply({ content: "`❌`・Ambiente de execução inválido, utilize: " + VALID_RUNTIMES.join(", "), flags: 64 });
            }

            if (!runCommand){
                return await interaction.reply({ content: "`❌`・Por favor, preencha o comando de execução", flags: 64 });
            }

            await databases.products.create({ storeId, name, runCommand, runtimeEnvironment });    
            await client.invokeInteraction(`config-products:${storeId}`, interaction);
            await interaction.followUp({ content: "`✅`・Produto adicionado com sucesso", flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "select-edit-product",

    run: async (client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (!interaction.isAnySelectMenu()){
            return;
        }

        return client.invokeInteraction(`edit-product-handler:${storeId}:${interaction.values[0]}`, interaction);        
    }
})

new InteractionHandler({
    customId: "edit-product-handler",
    
    run: async (_client, interaction, storeId, productId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const product = await databases.products.findOne({ _id: productId, storeId });
        if (!product){
            return await interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        const { weekly, biweekly, monthly, lifetime } = product.prices || {};
        const nonUpdatedApplications = await databases.applications.find({ productId, version: { $ne: product.currentReleaseVersion } }).countDocuments();

        const contents = [
            `# Editando produto: ${product.name}`,
            `- Aqui você poderá editar as informações do produto!\n`,

            `\`📝\`・Nome do produto: \`${product.name}\` - \`Versão: ${product.currentReleaseVersion}\``,
            `\`📦\`・Aplicações na fila de update: \`${nonUpdatedApplications}\`\n   `,
            `\`📂\`・Comando de Execução: \`${product.runCommand}\``,
            `\`🖥️\`・Ambiente de execução: \`${product.runtimeEnvironment}\`\n`,
            `\`💵\`・Valor Semanal: \`${weekly ? `R$ ${moneyFormatter(weekly)}` : "Não configurado"}\``,
            `\`💶\`・Valor Quinzenal: \`${biweekly ? `R$ ${moneyFormatter(biweekly)}` : "Não configurado"}\``,
            `\`💷\`・Valor Mensal: \`${monthly ? `R$ ${moneyFormatter(monthly)}` : "Não configurado"}\``,
            `\`💴\`・Valor Vitalicio: \`${lifetime ? `R$ ${moneyFormatter(lifetime)}` : "Não configurado"}\`\nㅤ`,
        ]

        const components = [
            CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `on-select-edit-product:${storeId}:${productId}`,
                    placeholder: "Selecione uma opção",
                    options: [
                        { label: "Editar nome", value: "name", emoji: emojis.config, description: "Clique para editar o nome do produto" },
                        { label: "Configurar painel", value: "message", emoji: emojis.config, description: "Clique para configurar a mensagem" },
                        { label: "Configurar Preços", value: "prices", emoji: emojis.config, description: "Clique para configurar os preços" },
                        { label: "Configurar Comando de execução", value: "runCommand", emoji: emojis.config, description: "Clique para configurar o comando de execução" },
                        { label: "Configurar ambiente de execução", value: "runtimeEnvironment", emoji: emojis.config, description: "Clique para configurar o ambiente de execução" },
                        { label: "Deletar produto", value: "delete", emoji: "⚠️", description: "Clique para deletar o produto" },
                    ]
                })
            ]),
            CreateRow([
                CreateButton({ label: "Publicar mensagem", style: 1, customId: `edit-product-f:${storeId}:${productId}:select-channel-publish`, emoji: emojis.yes}),
                CreateButton({ label: "Sincronizar mensagem", style: 1, customId: `edit-product-f:${storeId}:${productId}:sync-message`, emoji: emojis.reload}),
                CreateButton({ label: "Preview mensagem", style: 1, customId: `edit-product-f:${storeId}:${productId}:preview`, emoji: emojis.art}),
            ]),
            CreateRow([
                CreateButton({ label: "Teste gratis", style: 2, customId: `edit-product-f:${storeId}:${productId}:redeem-show-modal`, emoji: emojis.gift, disabled: true}),
                CreateButton({ label: "Atualização Automática", style: 2, customId: `auto-update:${productId}`, emoji: emojis.foldder}),
                CreateButton({ label: "Atualizar Painel", style: 2, customId: `edit-product-handler:${storeId}:${productId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: `config-products:${storeId}`, emoji: emojis.back})
            ])
        ]

        if (interaction.replied || interaction.deferred){
            return await (interaction as any).editReply({ ...V2Reply(contents.join("\n"), components), files: [] });
        }else{
            return await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] })
        }
    }
})

/**
 * Bloco responsável por lidar com as interações de edição de produtos
 */
new InteractionHandler({
    customId: "on-select-edit-product",

    run: async (client, interaction, storeId, productId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (!interaction.isAnySelectMenu()){
            return;
        }
       
        const option = interaction.values[0];
        
        if (option === "name"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:name-show-modal`, interaction);
        }

        if (option === "message"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:message-show-modal`, interaction);
        }

        if (option === "prices"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:prices-show-modal`, interaction);
        }

        if (option === "runCommand"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:runCommand-show-modal`, interaction);
        }

        if (option === "runtimeEnvironment"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:runtimeEnvironment-show-modal`, interaction);
        }

        if (option === "delete"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:delete-show-confirm-modal`, interaction);
        }

        if (option === "sync-file"){
            return client.invokeInteraction(`edit-product-f:${storeId}:${productId}:sync-file-show-modal`, interaction);
        }
    }
})

new InteractionHandler({
    customId: "edit-product-f",

    run: async (client, interaction, storeId, productId, option) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const product = await databases.products.findOne({ _id: productId, storeId });
        if (!product){
            return await interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        if (option === "name-show-modal"){

            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:name-submit-modal`,
                title: "Editando nome",
                inputs: [
                    { label: "Nome do produto", placeholder: "Digite o nome do produto", required: true, style: TextInputStyle.Short, customId: "name", value: product.name },
                ]
            })

            return modal.show(interaction as any);        
        }

        if (option === "name-submit-modal" && interaction.isModalSubmit()){
            const name = interaction.fields.getTextInputValue("name");

            if (!name){
                return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });
            }

            await databases.products.findByIdAndUpdate(productId, { name });
            await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);
            return await interaction.followUp({ content: "`✅`・Nome do produto editado com sucesso", flags: 64 });
        }

        if (option === "message-show-modal"){
            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:message-submit-modal`,
                title: "Editando mensagem",
                inputs: [
                    { label: "Nome do botão", placeholder: "Digite o nome do botão", required: true, style: TextInputStyle.Short, customId: "buttonName", value: product.messageSettings?.buttonName },
                    { label: "Link do video", placeholder: "Digite o link do video", required: false, style: TextInputStyle.Short, customId: "video", value: product.messageSettings?.video },
                    { label: "Link do banner", placeholder: "Digite o link do banner", required: false, style: TextInputStyle.Short, customId: "banner", value: product.messageSettings?.banner },
                    { label: "Descrição", placeholder: "Digite a descrição", required: false, style: TextInputStyle.Paragraph, customId: "description", value: product.messageSettings?.description },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "message-submit-modal" && interaction.isModalSubmit()){

            const buttonName = interaction.fields.getTextInputValue("buttonName");
            const video = interaction.fields.getTextInputValue("video");
            const banner = interaction.fields.getTextInputValue("banner");
            const description = interaction.fields.getTextInputValue("description");

            await databases.products.findByIdAndUpdate(productId, { $set: { "messageSettings.buttonName": buttonName, "messageSettings.video": video, "messageSettings.banner": banner, "messageSettings.description": description} });
            await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);
            return await interaction.followUp({ content: "`✅`・Mensagem editada com sucesso! **Não esqueça de sincronizar a mensagem novamente para que tenha efeito.**", flags: 64 });
        }

        if (option === "prices-show-modal"){
            const { weekly, biweekly, monthly, lifetime } = product.prices || {};

            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:prices-submit-modal`,
                title: "Editando preços",
                inputs: [
                    { label: "Preço semanal", placeholder: "Digite o preço semanal", required: false, style: TextInputStyle.Short, customId: "weekly", value: weekly ? String(product.prices?.weekly) : undefined },
                    { label: "Preço quinzenal", placeholder: "Digite o preço quinzenal", required: false, style: TextInputStyle.Short, customId: "biweekly", value: biweekly ? String(product.prices?.biweekly) : undefined },
                    { label: "Preço mensal", placeholder: "Digite o preço mensal", required: false, style: TextInputStyle.Short, customId: "monthly", value: monthly ? String(product.prices?.monthly) : undefined },
                    { label: "Preço vitalicio", placeholder: "Digite o preço vitalicio", required: false, style: TextInputStyle.Short, customId: "lifetime", value: lifetime ? String(product.prices?.lifetime) : undefined },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "prices-submit-modal" && interaction.isModalSubmit()){
            const weekly = interaction.fields.getTextInputValue("weekly")?.replace(",", ".");
            const biweekly = interaction.fields.getTextInputValue("biweekly")?.replace(",", ".");
            const monthly = interaction.fields.getTextInputValue("monthly")?.replace(",", ".");
            const lifetime = interaction.fields.getTextInputValue("lifetime")?.replace(",", ".");

            try {
                if (!weekly && !biweekly && !monthly && !lifetime){
                    throw new Error("Por favor, preencha ao menos um campo de preço");
                }

                if (weekly && isNaN(Number(weekly))){
                    throw new Error("Preço semanal inválido, utilize apenas números!");
                }
    
                if (biweekly && isNaN(Number(biweekly))){
                    throw new Error("Preço quinzenal inválido, utilize apenas números!");
                }
    
                if (monthly && isNaN(Number(monthly))){
                    throw new Error("Preço mensal inválido, utilize apenas números!");
                }
    
                if (lifetime && isNaN(Number(lifetime))){
                    throw new Error("Preço vitalicio inválido, utilize apenas números!");
                }
    
                await databases.products.findByIdAndUpdate(productId, { prices: { weekly, biweekly, monthly, lifetime } })
                await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);

                return await interaction.followUp({ content: "`✅`・Preços editados com sucesso", flags: 64 });
            }catch(e: any){
                await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);
                return await interaction.followUp({ content: `\`❌\`・${e.message}`, flags: 64 });
            }
        }

        if (option === "delete-show-confirm-modal"){
            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:delete-submit-modal`,
                title: "Deletando produto",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirm" },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "runtimeEnvironment-show-modal"){
            const currentRuntime = product.runtimeEnvironment || "nodejs";
            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:runtimeEnvironment-submit-modal`,
                title: "Editando ambiente de execução",
                inputs: [
                    { label: "Ambiente de execução", placeholder: "nodejs, python, java, go, rust, dotnet, deno", required: true, style: TextInputStyle.Short, customId: "runtimeEnvironment", value: currentRuntime },
                ]
            })
            return modal.show(interaction as any);
        }

        if (option === "runtimeEnvironment-submit-modal" && interaction.isModalSubmit()){
            const runtimeEnvironment = interaction.fields.getTextInputValue("runtimeEnvironment");
            if (!VALID_RUNTIMES.includes(runtimeEnvironment)){
                return await interaction.reply({ content: "`❌`・Ambiente de execução inválido, utilize: " + VALID_RUNTIMES.join(", "), flags: 64 });
            }

            await databases.products.findByIdAndUpdate(productId, { runtimeEnvironment });
            await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);
            return await interaction.followUp({ content: "`✅`・Ambiente de execução editado com sucesso", flags: 64 });
        }

        if (option === "runCommand-show-modal"){
            const currentrunCommand = product.runCommand || "index.js";

            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:runCommand-submit-modal`,
                title: "Editando comando de execução",
                inputs: [
                    { label: "Comando de execução", placeholder: "index.js, main.py", required: true, style: TextInputStyle.Short, customId: "runCommand", value: currentrunCommand },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "runCommand-submit-modal" && interaction.isModalSubmit()){

            const runCommand = interaction.fields.getTextInputValue("runCommand");
            if (!runCommand){
                return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });
            }

            await databases.products.findByIdAndUpdate(productId, { runCommand });
            await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);

            return await interaction.followUp({ content: "`✅`・Comando de execução editado com sucesso", flags: 64 });
        }

        if (option === "delete-submit-modal" && interaction.isModalSubmit()){
            const confirm = interaction.fields.getTextInputValue("confirm");

            if (confirm !== "sim"){
                return await interaction.reply({ content: "`❌`・Confirmação inválida", flags: 64 });
            }

            const applications = await databases.applications.find({ productId });
            if (applications.length){
                return await interaction.reply({ 
                    content: `\`❌\`・Não é possível deletar o produto, pois existem ${applications.length} aplicações atreladas a ele. Por favor, remova as aplicações antes de deletar o produto.`, 
                    flags: 64 
                });
            }

            await fs.rm(`releases/${productId}`, { force: true, recursive: true }).catch(() => null);

            await databases.products.findByIdAndDelete(productId);
            await client.invokeInteraction(`config-products:${storeId}`, interaction);
            return await interaction.followUp({ content: "`✅`・Produto deletado com sucesso", flags: 64 });
        }

        if (option === "select-channel-publish"){
            const contents = [
                `# Publicando mensagem`,
                `- Selecione o canal que deseja publicar a mensagem do produto!\nㅤ`,
            ]

            const components = [
                CreateRow([
                    new CreateSelect().ChannelSelectMenuBuilder({ customId: `edit-product-f:${storeId}:${productId}:publish`, placeholder: "Selecione um canal", type: ChannelType.GuildText }),
                ]),
                CreateRow([
                    CreateButton({ label: "Cancelar", style: 2, customId: `edit-product-handler:${storeId}:${productId}`, emoji: emojis.cancel}),
                ])
            ]

            return await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
        }

        if (option === "publish" && interaction.isAnySelectMenu()){

            const hasPermissionAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
            if (!hasPermissionAdmin){
                return await interaction.reply({ content: "`❌`・Você precisa da permissão de administrador para publicar a mensagem", flags: 64 });
            }

            const channelId = interaction.values[0];
            const channel = interaction.guild?.channels.cache.get(channelId) as any;

            if (!channel){
                return await interaction.reply({ content: "`❌`・Canal não encontrado", flags: 64 });
            }

            const content = product.messageSettings?.description;
            const banner = product.messageSettings?.banner;
            const video = product.messageSettings?.video;
            const buttonName = product.messageSettings?.buttonName;

            if (!content){
                return interaction.reply({ content: "`❌`・Mensagem do painel não configurada", flags: 64 });
            }

            const components = [
                CreateRow([
                    CreateButton({ label: buttonName || "Comprar", style: 3, customId: `buy-product:${storeId}:${productId}`, emoji: emojis.cart}),
                    CreateButton({ label: "Video demonstrativo", style: 5, customId: "", url: video || "https://youtube.com", disabled: !video}),
                ])
            ];

            try {
                const message = await channel.send(V2Reply(content, components, { files: banner ? [banner] : [] }));
                await product.updateOne({ $set: { "messageSettings.channelId": channelId, "messageSettings.messageId": message.id } });

                await client.invokeInteraction(`edit-product-handler:${storeId}:${productId}`, interaction);
                await interaction.followUp({ content: "`✅`・Mensagem publicada com sucesso", flags: 64 });

            }catch(e: any){
                return interaction.reply({ content: `\`❌\`・Erro ao publicar mensagem: ${e.message}`, flags: 64 });
            }
        }

        if (option === "sync-message"){
            const content = product.messageSettings?.description;
            const banner = product.messageSettings?.banner;
            const video = product.messageSettings?.video;
            const buttonName = product.messageSettings?.buttonName;

            if (!content){
                return interaction.reply({ content: "`❌`・Mensagem do painel não configurada", flags: 64 });
            }

            const components = [
                CreateRow([
                    CreateButton({ label: buttonName || "Comprar", style: 3, customId: `buy-product:${storeId}:${productId}`, emoji: emojis.cart}),
                    CreateButton({ label: "Video demonstrativo", style: 5, customId: "", url: video || "https://youtube.com", disabled: !video}),
                ])
            ];

            try {
                if (!product.messageSettings?.channelId){
                    throw new Error("Canal da mensagem não configurado. Publique a mensagem novamente!");
                }

                const channel = interaction.guild?.channels.cache.get(product.messageSettings?.channelId) as any;
                if (!channel){
                    throw new Error("Canal não encontrado. Publique a mensagem novamente!");
                }

                const message = await channel.messages.fetch(product.messageSettings.messageId).catch(() => null);
                if (!message){
                    const newMessage = await channel.send(V2Reply(content, components, { files: banner ? [banner] : [] }));
                    await databases.products.findByIdAndUpdate(productId, { "messageSettings.messageId": newMessage.id });
                    await interaction.reply({ content: "`✅`・A Mensagem antiga não foi encontrada para ser editada, então o sistema criou outra mensagem automaticamente!", flags: 64 });

                }else{
                    await message.edit(V2Reply(content, components, { files: banner ? [banner] : [] }));
                    await interaction.reply({ content: "`✅`・Mensagem sincronizada com sucesso", flags: 64 });
                }

            }catch(e: any){
                return await interaction.reply({ content: `\`❌\`・Mensagem não sincronizada: ${e.message}`, flags: 64 });
            }
        }

        if (option === "preview"){
            const content = product.messageSettings?.description;
            const banner = product.messageSettings?.banner;
            const video = product.messageSettings?.video;
            const buttonName = product.messageSettings?.buttonName;

            if (!content){
                return interaction.reply({ content: "`❌`・Mensagem do painel não configurada", flags: 64 });
            }

            const components = [
                CreateRow([
                    CreateButton({ label: buttonName || "Comprar", style: 3, customId: `buy-product:${storeId}:${productId}`, emoji: emojis.cart, disabled: true}),
                    CreateButton({ label: "Video demonstrativo", style: 5, customId: "", url: video || "https://youtube.com", disabled: !video}),
                ])
            ];

            return interaction.reply(V2Reply(content, components, { files: banner ? [banner] : [] }));
        }

        if (option === "redeem-show-modal"){
            const modal = CreateModal({
                customId: `edit-product-f:${storeId}:${productId}:redeem-submit-modal`,
                title: "Configurando sistema de resgate",
                inputs: [
                    { label: "Ativo ?", placeholder: "Utilize 'sim' ou 'não'", required: true, style: TextInputStyle.Short, customId: "redeemActive", value: product.redeemSettings?.active ? "sim" : "não" },
                    { label: "Dias de acesso", placeholder: "Digite a quantidade de dias", required: true, style: TextInputStyle.Short, customId: "redeemDays", value: product.redeemSettings?.days ? String(product.redeemSettings?.days) : undefined },
                    { label: "Webhook", placeholder: "Digite o webhook", required: false, style: TextInputStyle.Short, customId: "redeemWebhook", value: product.redeemSettings?.webhook },
                ]
            })

            return modal.show(interaction as any);
        }
    }
})

/**
 * Bloco responsável por lidar com a proteção de arquivos
 * Essa proteção é feita para que os arquivos não sejam substituidos durante o processo de atualização
 */

new InteractionHandler({
    customId: "auto-update",

    run: async (_client, interaction, productId) => {

        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64});
        }
        
        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: product.storeId.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const errorOnUpdateApplications = await databases.applications.find({ productId, errorOnUpdate: true }).countDocuments();
        const pendingUpdateApplications = await databases.applications.find({ productId, version: { $ne: product.currentReleaseVersion }, errorOnUpdate: false }).countDocuments();

        const contents: string[] = [
            "# Sistema de atualização",
            `- Aqui você poderá configurar o sistema de atualização automática do produto \`${product.name}\`!\n`,
            `- Versão atual: **${product.currentReleaseVersion}**`,
            `- Aplicações na fila de update: ${pendingUpdateApplications > 0 ? `\`${pendingUpdateApplications} Aplicações 🟡\`` : "`Nenhuma aplicação 🟢`"}`,
            `- Aplicações com erro ao atualizar: ${errorOnUpdateApplications > 0 ? `\`${errorOnUpdateApplications} Aplicações ⚠️\`` : "`Nenhuma aplicação 🟢`"}\n`
        ];

        const baseButtons = [
            CreateRow([
                CreateButton({ label: "Arquivos protegidos", style: 1, customId: `change-protected-files:${productId}:show-modal`, emoji: emojis.settings}),
                CreateButton({ label: "Atualizar aplicações com erro", style: 1, emoji: emojis.copy, customId: `force-update-applications:${productId}:show-modal`, disabled: (errorOnUpdateApplications <= 0 || product.needToUpdateApplications) }),
                CreateButton({ label: "Status das atualizações", style: 1, customId: `status-update:${productId}`, emoji: emojis.foldder}),
            ]),
            CreateRow([
                CreateButton({ label: "Atualizar esse painel", style: 2, customId: `auto-update:${productId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar ao menu anterior", style: 2, customId: `edit-product-handler:${product.storeId}:${productId}`, emoji: emojis.back})
            ])
        ]

        const components = [...baseButtons];

        // === Releases ===
        if (product.releases?.length) {
            product.releases.reverse();

            const options = product.releases.map((release: any) => {
                const formattedDate = release.date.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                });

                const isCurrent = release.version === product.currentReleaseVersion;

                return {
                    label: `Versão: ${release.version}${isCurrent ? " (atual)" : ""}`,
                    value: release._id.toString(),
                    description: `Enviado: ${formattedDate}`,
                    emoji: isCurrent ? "✅" : "🔴"
                };
            });

            // Select de versões
            components.unshift(CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `select-release:${productId}`,
                    options,
                    placeholder: "Selecione uma versão",
                    getValueInLastParam: true,
                })
            ]));

            if (product.currentReleaseVersion) {
                contents.push("-# `⚠️`・Utilize o botão `Arquivos protegidos` para configurar os arquivos que não serão substituídos durante o processo de atualização.");
            } else {
                contents.push("-# `❌`・Ainda não foi especificada uma versão atual do produto, selecione uma versão no select para definir como atual!");
            }

            if (errorOnUpdateApplications > 0) {
                contents.push("-# `⚠️`・Existem aplicações com erro ao atualizar, utilize o botão `Atualizar aplicações com erro` para tentar novamente.");
            }

        } else {
            contents.push("-# `❌`・Nenhuma release encontrada para esse produto! Utilize o comando `/enviar-release` para enviar uma release.");
        }

        // === Resposta ===
        return (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
    }
});

new InteractionHandler({
    customId: "status-update",
    run: async (client, interaction, productId) => {

        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        const pendingUpdateApplications = await databases.applications.find({ productId, version: { $ne: product.currentReleaseVersion }}).sort({ errorOnUpdate: -1 });

        const formatedAllApplications = pendingUpdateApplications.map((application) => {
            const messageList = [
                `Dono: ${application.ownerId} (${client.users.cache.get(application.ownerId)?.username || "Desconhecido"})`,
                `ID da Aplicação: ${application._id}`,
                `Aplicação: ${application.name} - v${application.version}`,
                `Status: ${application.errorOnUpdate ? "Erro ao atualizar ⚠️" : "Atualização pendente 🟡"}`,
            ]

            if (application.errorOnUpdate) {
                messageList.push(`Mensagem de erro: ${application.errorOnUpdateMessage || "Nenhuma mensagem de erro"}`);
            }

            return messageList.join("\n");
        });

        const txtContent = formatedAllApplications.join("\n\n----\n\n") || "✅・Nenhuma aplicação encontrada, Todas aplicações estão atualizadas!";
        const txtFile = new AttachmentBuilder(Buffer.from(txtContent), { name: "status-update.txt" });

        return interaction.reply({ content: "`✅`・Status das atualizações", files: [txtFile], flags: 64 });
    }
});

new InteractionHandler({
    customId: "force-update-applications",
    run: async (client, interaction, productId, action) => {

        if (action === "show-modal") {
            const modal = CreateModal({
                customId: `force-update-applications:${productId}:submit-modal`,
                title: "Atualizar aplicações com erro",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirmation" },
                ]
            });

            return modal.show(interaction as any);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {

            const confirmation = interaction.fields.getTextInputValue("confirmation");
            if (confirmation.toLowerCase() !== "sim") {
                return interaction.reply({ content: "`❌`・Confirmação inválida, digite 'sim' para confirmar a atualização.", flags: 64 });
            }

            try {
                await databases.products.findByIdAndUpdate(productId, { $set: { needToUpdateApplications: true } });
                const update = await databases.applications.updateMany({ productId, errorOnUpdate: true }, { $set: { errorOnUpdate: false, updateAttempts: 0 }, $unset: { errorOnUpdateMessage: "" } });
    
                await client.invokeInteraction(`auto-update:${productId}`, interaction);
                return interaction.followUp({ content: `\`✅\`・${update.modifiedCount} aplicações adicionadas a fila de atualização`, flags: 64 });
            }catch(e: any){
                return interaction.reply({ content: `\`❌\`・Erro ao atualizar aplicações: ${e.message}`, flags: 64 });
            }
        }
    }
});

/**
 * Bloco responsável por lidar com a proteção de arquivos
 */
new InteractionHandler({
    customId: "change-protected-files",

    run: async (client, interaction, productId, action) => {

        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: product.storeId.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal") {
            const protectedFiles = product.protectedFiles || [];
            const protectedFilesString = protectedFiles.length ? protectedFiles.join("\n") : undefined;

            const exemples = [
                "Exemplo:",
                "databases/*.json (ignora todos .json da pasta databases)",
            ]

            const modal = CreateModal({
                customId: `change-protected-files:${productId}:submit-modal`,
                title: "Arquivos protegidos",
                inputs: [
                    { label: "Arquivos protegidos", placeholder: exemples.join('\n'), required: false, style: TextInputStyle.Paragraph, customId: "protectedFiles", value: protectedFilesString },
                ]
            });

            return modal.show(interaction as any);
        }


        if (action === "submit-modal" && interaction.isModalSubmit()) {
            const protectedFilesInput = interaction.fields.getTextInputValue("protectedFiles");
            const protectedFiles = protectedFilesInput.split("\n").map(file => file.trim()).filter(file => file.length > 0);

            await databases.products.findByIdAndUpdate(productId, { protectedFiles });
            await client.invokeInteraction(`auto-update:${productId}`, interaction);
            return interaction.followUp({ content: "`✅`・Arquivos protegidos atualizados com sucesso", flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "select-release",

    run: async (_client, interaction, productId, releaseId, _page) => {

        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }   

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: product.storeId.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const release = product.releases?.find((r: any) => r._id.toString() === releaseId);
        if (!release) {
            return interaction.reply({ content: "`❌`・Release não encontrada", flags: 64 });
        }

        const page = _page ? Number(_page) : 1;
        if (isNaN(page) || page < 0) {
            return interaction.reply({ content: "`❌`・Página inválida", flags: 64 });
        }

        const releaseFormatedDate = release.date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });

        const releaseFileStat = await fs.stat(release.path).catch(() => null);

        const contents: string[] = [
            `# Detalhes da Release ${release.version}`,
            `- Enviada em: \`${releaseFormatedDate}\``,
            `- Tamanho do arquivo: \`${releaseFileStat ? `${bytes(releaseFileStat.size, { unitSeparator: " "})}` : "Desconhecido"}\`\n`,
            `- **Legendas:**`,
            `> \`🟢\`・Arquivo protegido, não será substituído durante o processo de atualização.`,
            `> \`🔴\`・Arquivo não protegido, será substituído durante o processo de atualização.\n`,
        ];

        if (product.needToUpdateApplications) {
            contents.push("> -# `⚠️`・**O sistema de atualização está em andamento, não é possível alterar a release até que seja concluído.**\n");
        }

        if (!releaseFileStat) {
            contents.push("-# `❌`・Arquivo não encontrado, verifique se a release foi enviada corretamente.");
        }

        const isCurrentRelease = release.version === product.currentReleaseVersion;
        if (isCurrentRelease) {
            contents.push("-# `✅`・Essa é a versão atual do produto");
        }else{
            contents.push("> -# `⚠️`・Essa não é a versão atual do produto, utilize o botão `Definir como atual` para definir essa versão como a atual. Após fazer isso, o sistema irá atualizar automaticamente as aplicações para essa versão.\n");
            contents.push("> -# `⚠️`・Antes de trocar a release do produto, confirme se os \"Arquivos protegidos\" foram devidamente configurados, caso contrário, poderá ocorrer perda de dados ou arquivos importantes que não devem ser substituídos.");
        }

        const productFiles = new AdmZip(`./releases/${productId}/${release.version}.zip`);
        const ig = ignore().add(product.protectedFiles || []);

        const options = productFiles.getEntries().map((entry) => {
            const _protected = ig.ignores(entry.entryName);

            return {
                label: entry.entryName,
                value: entry.entryName,
                emoji: _protected ? "🟢" : "🔴",
                description: `${_protected ? "Esse arquivo está protegido, não será substituido" : "Esse arquivo será substituido no BOT do cliente" }・${bytes(entry.header.size, { unitSeparator: " " })}`,
            }
        })

        const pageSystem = new PageSystem({data: options, maxItemPerPage: 25});

        const components = [
            CreateRow([
                CreateButton({ label: " ", emoji: "⬅️", style: 1, customId: `select-release:${productId}:${release._id.toString()}:${page - 1}`, disabled: page <= 1 }),
                CreateButton({ label: `Pagina ${page}/${pageSystem.totalPages}`, style: 2, customId: `N/A`, disabled: true }),
                CreateButton({ label: " ", emoji: "➡️", style: 1, customId: `select-release:${productId}:${release._id.toString()}:${page + 1}`, disabled: page >= pageSystem.totalPages }),
            ]),
            CreateRow([
                CreateButton({ label: "Definir como atual", style: 1, customId: `set-current-release:${productId}:${release._id.toString()}:show-modal`, emoji: emojis.yes, disabled: (isCurrentRelease || product.needToUpdateApplications) }),
                CreateButton({ label: "Baixar release", style: 1, customId: `download-release:${productId}:${release._id.toString()}`, emoji: emojis.foldder }),
                CreateButton({ label: "Excluir release", style: 4, customId: `delete-release:${productId}:${release._id.toString()}:show-modal`, emoji: emojis.trash }),
                CreateButton({ label: "Atualizar painel", style: 2, customId: `select-release:${productId}:${release._id.toString()}:${page}`, emoji: emojis.reload }),
                CreateButton({ label: "Voltar", style: 2, customId: `auto-update:${productId}`, emoji: emojis.back })
            ]),
        ]

        if (options.length) {
            components.unshift(CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `select-release-files:${productId}:${release._id.toString()}`,
                    placeholder: "Nenhum arquivo encontrado",
                    options: pageSystem.getPage(page),
                })
            ]));
        }

        return (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
    }
})

/**
 * Bloco responsável por excluir uma release
 */
new InteractionHandler({
    customId: "delete-release",

    run: async (client, interaction, productId, releaseId, option) => {

        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: product.storeId.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const release = product.releases?.find((r: any) => r._id.toString() === releaseId);
        if (!release) {
            return interaction.reply({ content: "`❌`・Release não encontrada", flags: 64 });
        }

        const isCurrentRelease = release.version === product.currentReleaseVersion;
        if (isCurrentRelease) {
            return interaction.reply({ content: "`❌`・Não é possível excluir a versão atual do produto, defina outra versão como atual antes de excluir essa.", flags: 64 });
        }

        if (option === "show-modal") {
            const modal = CreateModal({
                customId: `delete-release:${productId}:${releaseId}:submit-modal`,
                title: "Deletando Release",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirm" },
                ]
            });

            return modal.show(interaction as any);
        }

        if (option === "submit-modal" && interaction.isModalSubmit()) {
            const confirm = interaction.fields.getTextInputValue("confirm");

            if (confirm.toLowerCase() !== "sim") {
                return interaction.reply({ content: "`❌`・Confirmação inválida, digite 'sim' para confirmar a exclusão.", flags: 64 });
            }

            await databases.products.findByIdAndUpdate(productId, { $pull: { releases: { _id: releaseId } } });
            await fs.rm(release.path, { force: true }).catch(() => null);

            await client.invokeInteraction(`auto-update:${productId}`, interaction);
            return interaction.followUp({ content: "`✅`・Release deletada com sucesso", flags: 64 });
        }
    }
})

/**
 * Bloco responsável por baixar uma release
 */
new InteractionHandler({
    customId: "download-release",

    run: async (client, interaction, productId, releaseId) => {

        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: product.storeId.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const release = product.releases?.find((r: any) => r._id.toString() === releaseId);
        if (!release) {
            return interaction.reply({ content: "`❌`・Release não encontrada", flags: 64 });
        }

        const releaseFileStat = await fs.stat(release.path).catch(() => null);
        if (!releaseFileStat) {
            return interaction.reply({ content: "`❌`・Arquivo não encontrado, verifique se a release foi enviada corretamente.", flags: 64 });
        }

        const fileName = `release-${productId}-${release.version}.zip`;
        const fileBuffer = await fs.readFile(release.path).catch(() => null);

        if (!fileBuffer) {
            return interaction.reply({ content: "`❌`・Erro ao ler o arquivo da release, verifique se a release foi enviada corretamente.", flags: 64 });
        }

        await interaction.reply({
            content: "`✅`・Download iniciado, clique no link abaixo para baixar a release.",
            files: [{ attachment: fileBuffer, name: fileName }],
            flags: 64
        });
    }
});

/**
 * Bloco responsável por definir uma release como a atual
 */
new InteractionHandler({
    customId: "set-current-release",

    run: async (client, interaction, productId, releaseId, action) => {
        
        const product = await databases.products.findOne({ _id: productId });
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado", flags: 64 });
        }

        if (product.needToUpdateApplications) {
            return interaction.reply({ content: "`❌`・Não é possível definir uma versão atual, pois o sistema de atualização está em andamento.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: product.storeId.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const release = product.releases?.find((r: any) => r._id.toString() === releaseId);
        if (!release) {
            return interaction.reply({ content: "`❌`・Release não encontrada", flags: 64 });
        }

        if (release.version === product.currentReleaseVersion) {
            return interaction.reply({ content: "`❌`・Essa já é a versão atual do produto", flags: 64 });
        }

        if (action === "show-modal"){
            const modal = CreateModal({
                customId: `set-current-release:${productId}:${releaseId}:confirm-modal`,
                title: "Definindo versão atual",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirm" },
                ]
            });

            return modal.show(interaction as any);
        }

        if (action === "confirm-modal" && interaction.isModalSubmit()) {
            const confirm = interaction.fields.getTextInputValue("confirm");

            if (confirm.toLowerCase() !== "sim") {
                return interaction.reply({ content: "`❌`・Confirmação inválida, digite 'sim' para confirmar a definição da versão atual.", flags: 64 });
            }

            await databases.products.findByIdAndUpdate(productId, { currentReleaseVersion: release.version, needToUpdateApplications: true });
            await databases.applications.updateMany({ productId: productId }, { $set: { updateAttempts: 0, errorOnUpdate: false }, $unset: { errorOnUpdateMessage: "" } });

            await client.invokeInteraction(`select-release:${productId}:${releaseId}`, interaction);
            return interaction.followUp({ content: "`✅`・Versão atual definida com sucesso. O processo de atualização será iniciado em breve!", flags: 64 });
        }
    }
});
