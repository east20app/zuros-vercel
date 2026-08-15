import acl, { getUserHasPermissionOnStore, PermissionsStore } from "@root/src/functions/acl";
import databases from "@root/src/databases";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import bytes from "bytes";
import fs from "fs/promises";

import { emojis, V2Reply } from "@root/src/functions";
import { ActionRowBuilder, ChannelType, PermissionsBitField, TextInputStyle } from "discord.js";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";
import path from "path";

new InteractionHandler({
    customId: "advanced-config",

    run: async (_client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const store = await databases.stores.findOne({ _id: storeId });
        if (!store){
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        // Informações do usuário que está interagindo
        const userInfo = await databases.userSettings.findOne({ userId_discord: interaction.user.id });

        // Informações do dono da loja
        const storeOwnerConfig = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
        if (!storeOwnerConfig){
            return interaction.reply({ content: "`❌`・Dono da loja não encontrado!", flags: 64 });
        }

        // Vamos verificar se o usuário que está interagindo é o dono da loja ou tem permissão na loja
        const isStoreOwner = !!store.ownerId_campos && !!userInfo?.userId_campos && store.ownerId_campos === userInfo.userId_campos;
        const hasStorePermission = store.permissions?.find(p => p.userId === interaction.user.id);

        if (!isStoreOwner && !hasStorePermission){
            return interaction.reply({ content: "`❌`・Você não tem permissão para acessar as configurações desta loja!", flags: 64 });
        }

        const contents = [
            `# Configurando lojas`,
            `- Aqui você poderá configurar sua loja \`${store.name}\`\n`,
        ]

        const token_campos = storeOwnerConfig?.settings?.["token_campos"];

        const sdk = token_campos ? await sdkWrapper.getInstance(storeOwnerConfig.userId_discord) : null;
        const userDataCampos = sdk ? await sdk.instance.getMe().catch(() => null) : null;
        const planUsage = sdk ? await sdkWrapper.getPlanUsage(storeOwnerConfig.userId_discord).catch(() => null) : null;

        const currentUserPlan = userDataCampos?.currentSubscription?.planReference;
        const expirationDate = userDataCampos?.currentSubscription?.endAt ? new Date(userDataCampos.currentSubscription.endAt) : null;
        
        if (userDataCampos) {
            contents.push(`> Informações do dono da loja na [Campos Cloud](<https://camposcloud.com/dashboard/applications>)`);
            contents.push(`- Nome: \`${userDataCampos.name}\``);
            contents.push(`- Email: \`${userDataCampos.email}\``);

            if (planUsage){
                const emoji = planUsage.utilizedMemoryPercentage > 80 ? "🟥" : planUsage.utilizedMemoryPercentage > 50 ? "🟡" : "🟢";
                contents.push(`- Plano: \`${`${currentUserPlan?.name} - ${bytes(planUsage.totalMemory * 1024 * 1024, {unitSeparator: " "})} (${planUsage.utilizedMemoryPercentage}% utilizado) ${emoji}`}\``);
            }
        }

        if (expirationDate) {
            const formated = expirationDate.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" });
            const days = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const emoji = days <= 7 ? "🟡" : "🟢";

            contents.push(`- Data de expiração: \`${formated} (${days} dias) ${emoji}\``);
        }
 
        const components = [
            CreateRow([
                CreateButton({ label: "Configurar Logs e Cargos", style: 1, customId: `config-logs:${storeId}`, emoji: emojis.config}),
                CreateButton({ label: "Configurar permissões", style: 1, customId: `config-permissions:${storeId}`, emoji: emojis.user}),
                CreateButton({ label: "Excluir loja", style: 4, customId: `delete-store:${storeId}:show-modal`, emoji: emojis.trash}),
            ]),
            CreateRow([
                CreateButton({ label: "Estatisticas de Vendas", style: 2, customId: `sales-statistics:${storeId}`, emoji: emojis.statistics}),
                CreateButton({ label: "Atualizar esse painel", style: 2, customId: `advanced-config:${storeId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: `config-store:${storeId}`, emoji: emojis.back})
            ])
        ]

        return await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] })
    }
})


/**
 * Bloco de exclusão de loja
 */
new InteractionHandler({
    customId: "delete-store",

    run: async (client, interaction, storeId, action) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const userInfo = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        if (!userInfo){
            return interaction.reply({ content: "`❌`・Você não está cadastrado!", flags: 64 });
        }

        const store = await databases.stores.findOne({ _id: storeId, ownerId_campos: userInfo.userId_campos });
        if (!store){
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        if (action === "show-modal"){
            const modal = CreateModal({
                customId: `delete-store:${storeId}:submit-modal`,
                title: "Excluindo loja",
                inputs: [
                    { label: "Confirme a exclusão", placeholder: `Digite "${store.name}" para confirmar`, required: true, style: TextInputStyle.Short, customId: "confirm-name"}
                ]
            });

            return await modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            const confirmName = interaction.fields.getTextInputValue("confirm-name");

            if (confirmName !== store.name){
                return await interaction.reply({ content: "`❌`・Nome incorreto! A loja não foi excluída.", flags: 64 });
            }

            const applicationsInStoreCount = await databases.applications.countDocuments({ storeId });
            if (applicationsInStoreCount > 0){
                return await interaction.reply({ content: `\`❌\`・Não é possível excluir a loja, pois existem \`${applicationsInStoreCount}\` aplicações associadas a ela. Por favor, remova as aplicações antes de excluir a loja.`, flags: 64 });
            }

            const productsInStore = await databases.products.find({ storeId });
            for (const product of productsInStore) {
                await fs.rm(path.join("releases", product._id.toString()), { recursive: true, force: true }).catch((e) => console.error(`❌・Erro ao tentar excluir a pasta de releases do produto ${product._id}:`, e));
            }

            await databases.products.deleteMany({ storeId });
            await databases.coupons.deleteMany({ storeId });

            await databases.stores.deleteOne({ _id: storeId, ownerId_campos: userInfo.userId_campos });
            await client.invokeInteraction("config", interaction);
            await interaction.followUp({ content: "`✅`・Loja excluída com sucesso!", flags: 64 });
        }
    }
})

/**
 * Bloco de configuração de permissões
 * Permite que o dono da loja adicione usuários com permissões específicas.
 */
new InteractionHandler({
    customId: "config-permissions",

    run: async (client, interaction, storeId) => {
        const userInfo = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        if (!userInfo) {
            return interaction.reply({ content: "`❌`・Você não está cadastrado!", flags: 64 });
        }

        const storeConfig = await databases.stores.findOne({ _id: storeId, ownerId_campos: userInfo.userId_campos });
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada ou você não tem permissão para acessar as configurações.", flags: 64 });
        }   

        const userPermissions = storeConfig.permissions || [];

        const contents = [
            `# Permissões do BOT`,
            `- Aqui você poderá configurar as permissões dos usuarios\n`,
            `- **Usuarios com permissão: (${userPermissions.length})**`,
        ]

        if (userPermissions.length > 0){
            userPermissions.map((userPermissionObject: any) => {
                const userId = userPermissionObject.userId;
                const permissions = userPermissionObject.permissions;

                const translatedPermissions = permissions.map((permission: string) => {
                    const translatedPermission = acl.get().find((p) => p.value === permission);
                    return translatedPermission?.label || permission;
                })

                const contentToPush = [
                    ` - ㅤ`,
                    ` - Usuario: <@${userId}>`,
                    ` - Permissões: \`${ permissions.length > 0 ? translatedPermissions.join(", ") : `\`Ainda não definido\``}\``,
                ]

                contents.push(contentToPush.join("\n"));
            })
        }else{
            contents.push(` - Nenhum usuario com permissão`);
        }

        const components = [
            CreateRow([
                CreateButton({ label: "Adicionar usuario", customId: `add-store-permission:${storeId}:show-modal`, emoji: emojis.add}),
                CreateButton({ label: "Atualizar painel", customId: `config-permissions:${storeId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", customId: `advanced-config:${storeId}`, emoji: emojis.back, style: 2})
            ])
        ]   

        if (userPermissions.length > 0) {
            const options = await Promise.all(
                userPermissions.map(async (userPermissionObject: any) => {
                    const user = await client.users.fetch(userPermissionObject.userId).catch(() => null);
                    const userId = userPermissionObject.userId;
                    return { label: user?.username || userId, description: `ID: ${userId}`, value: userId, emoji: emojis.user,};
                })
            );
        
            components.unshift(
                CreateRow([
                    new CreateSelect().StringSelectMenuBuilder({
                        customId: `config-permissions-user:handler:${storeId}`,
                        placeholder: "Selecione um usuário",
                        options: options,
                        getValueInLastParam: true,
                    }),
                ])
            );
        }

        contents.push("\nㅤ");
        await (interaction as any).update({...V2Reply(contents.join("\n"), components), files: []});
    }
})

new InteractionHandler({
    customId: "add-store-permission",

    run: async (client, interaction, storeId, action) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal"){
            const modal = CreateModal({
                title: "Adicionar usuario",
                customId: `add-store-permission:${storeId}:submit-modal`,
                inputs: [
                    {label: "ID do usuario", required: true, style: 1, placeholder: "413749917396238336", customId: "user-id"},
                ]
            })
    
            await modal.show(interaction);
            return;
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            const userId = interaction.fields.getTextInputValue("user-id");
            const userExists = await client.users.fetch(userId).catch(() => null);

            if (!userExists){
                return interaction.reply({ content: "`❌`・Usuario não encontrado", flags: 64 });
            }

            const storeDatabase = await databases.stores.findOne({ _id: storeId });
            if (!storeDatabase) {
                return interaction.reply({ content: "`❌`・Loja não encontrada", flags: 64 });
            }

            if (storeDatabase.permissions.find((userPermissionObject: any) => userPermissionObject.userId === userId)){
                return interaction.reply({ content: "`❌`・O usuario já possui permissão", flags: 64 });
            }

            await databases.stores.updateOne(
                { _id: storeId },
                { $push: { permissions: { userId, permissions: [] } } },
                { upsert: true }
            );

            await client.invokeInteraction(`config-permissions:${storeId}`, interaction);
            return interaction.followUp({ content: "`✅`・Permissão adicionada com sucesso", flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "config-permissions-user",

    run: async (client, interaction, action, storeId, userId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "handler"){

            const storeConfig = await databases.stores.findOne({ _id: storeId });
            if (!storeConfig) {
                return interaction.reply({ content: "`❌`・Loja não encontrada", flags: 64 });
            }

            const usersPermissions = storeConfig.permissions || [];
            const userPermissionObject = usersPermissions.find((userPermissionObject: any) => userPermissionObject.userId === userId) as any;
    
            if (!userPermissionObject){
                return interaction.reply({content: `\`❌\`・Usuario não encontrado na lista de permissões`, flags: 64});
            }
    
            let permissionString = "";
    
            if (userPermissionObject.permissions.length > 0){
                userPermissionObject.permissions.map((permission: string) => {
                    const translatedPermission = acl.get().find((p) => p.value === permission); 
                    permissionString += `\n - \`${translatedPermission?.label || permission}\``;
                })
            }
    
            const contents = [
                `# Editar permissões`,
                `- Aqui você poderá editar as permissões do usuario <@${userId}>\n`,
                `- **Permissões atuais:** ${ userPermissionObject.permissions.length > 0 ? `${permissionString}` : `\n - \`Ainda não definido\``}`,
            ]
            
            const components = [
                CreateRow([
                    new CreateSelect().StringSelectMenuBuilder({
                        customId: `config-permissions-user:toggle-permission:${storeId}:${userId}`,
                        placeholder: "Selecione uma permissão",
                        options: acl.get().map((permission) => {
                            const hasPermission = userPermissionObject.permissions.includes(permission.value);  
                            return {label: permission.label, value: permission.value, description: permission.description, emoji: hasPermission ? "🟢" : "🔴"}
                        })
                    })
                ]),
                CreateRow([
                    CreateButton({ label: "Atualizar painel", customId: `config-permissions-user:handler:${storeId}:${userId}`, emoji: emojis.reload}),
                    CreateButton({ label: "Remover usuario", customId: `config-permissions-user:remove-user:${storeId}:${userId}`, style: 4, emoji: emojis.trash}),
                    CreateButton({ label: "Voltar", customId: `config-permissions:${storeId}`, emoji: emojis.back, style: 2}),
                ])
            ]
    
            return (interaction as any).update(V2Reply(contents.join("\n"), components));
        }

        if (action === "toggle-permission" && interaction.isAnySelectMenu()){

            const storeConfig = await databases.stores.findOne({ _id: storeId });
            if (!storeConfig) {
                return interaction.reply({ content: "`❌`・Loja não encontrada", flags: 64 });
            }

            const usersPermissions = storeConfig.permissions || [];
            const userPermissionObject = usersPermissions.find((user: any) => user.userId === userId);

            if (!userPermissionObject){
                return interaction.reply({content: `\`❌\`・Usuario não encontrado na lista de permissões`, flags: 64});
            }

            const permission = interaction.values[0];
            const permissionIndex = userPermissionObject.permissions.indexOf(permission);

            if (permissionIndex === -1){
                userPermissionObject.permissions.push(permission);
            }else{
                userPermissionObject.permissions.splice(permissionIndex, 1);
            }

            await databases.stores.updateOne(
                { _id: storeId },
                { $set: { permissions: usersPermissions } }
            );

            await client.invokeInteraction(`config-permissions-user:handler:${storeId}:${userId}`, interaction);
        }

        if (action === "remove-user"){
            const contents = [
                `# Confirme essa ação`,
                `- Você realmente deseja remover a permissão desse usuario ? essa ação é irreversível!`,
            ]

            const components = [
                CreateRow([
                    CreateButton({ label: "Sim", customId: `config-permissions-user:confirmed-remove-user:${storeId}:${userId}`, style: 4, emoji: emojis.yes}),
                    CreateButton({ label: "Não, quero voltar", customId: `config-permissions-user:handler:${storeId}:${userId}`, emoji: emojis.cancel, style: 1}),
                ])
            ]

            await (interaction as any).update(V2Reply(contents.join("\n"), components));
        }

        if (action === "confirmed-remove-user"){
            const storeConfig = await databases.stores.findOne({ _id: storeId });
            if (!storeConfig) {
                return interaction.reply({ content: "`❌`・Loja não encontrada", flags: 64 });
            }

            const usersPermissions = storeConfig.permissions || [];
            const userPermissionObject = usersPermissions.find((user: any) => user.userId === userId);

            if (!userPermissionObject){
                return interaction.reply({content: `\`❌\`・Usuario não encontrado na lista de permissões`, flags: 64});
            }

            const newUsersPermissions = usersPermissions.filter((user: any) => user.userId !== userId);
            await databases.stores.updateOne(
                { _id: storeId },
                { $set: { permissions: newUsersPermissions } }
            );

            await client.invokeInteraction(`config-permissions:${storeId}`, interaction);
            await interaction.followUp({content: `\`✅\`・Usuario removido com sucesso`, flags: 64});
        }
    }
})

/**
 * Bloco de configuração de Logs e Cargos
 * Permite que o dono da loja configure os logs e cargos associados à loja.
 */
new InteractionHandler({
    customId: "config-logs",

    run: async (_client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const storeConfig = await databases.stores.findOne({ _id: storeId });
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada", flags: 64 });
        }

        const logsAndRoles = storeConfig.logsAndRoles || {};

        const sales = logsAndRoles?.sales;
        const renovations = logsAndRoles?.renovations;
        const transferOwnership = logsAndRoles?.transferOwnership;
        const expiredApplication = logsAndRoles?.expiredApplication;
        const customerRole = logsAndRoles?.customerRole;

        const contents = [
            `# Configurações de Logs`,
            `- Aqui você poderá configurar o canal de logs do BOT\n`,
            `\`👥\`・Cargo de Cliente: ${customerRole? `<@&${customerRole}>` : "`⚠️ Cargo não definido`"}\n`,
            `\`💸\`・Log de Vendas: ${sales ? `<#${sales}>` : "`⚠️ Canal não definido`"}`,
            `\`🔁\`・Log de Renovação: ${renovations ? `<#${renovations}>` : "`⚠️ Canal não definido`"}`,
            `\`👦\`・Log de Transferência de Dono: ${transferOwnership ? `<#${transferOwnership}>` : "`⚠️ Canal não definido`"}`,
            `\`⏳\`・Log de Aplicações expiradas: ${expiredApplication ? `<#${expiredApplication}>` : "`⚠️ Canal não definido`"}\nㅤ`,
        ]

        const components = [
            CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `config-logs-select:${storeId}:show-select-channel`,
                    placeholder: "Selecione uma opção",
                    options: [
                        { emoji: emojis.user, label: "Cargo de Cliente", value: "customerRole:role", description: "O Cargo de Cliente" },
                        { emoji: emojis.channels, label: "Logs de Vendas", value: "sales:channel", description: "O Canal onde será enviado as notificações de vendas" },
                        { emoji: emojis.channels, label: "Logs de Renovação", value: "renovations:channel", description: "O Canal onde será enviado as notificações de renovação" },
                        { emoji: emojis.channels, label: "Logs de Transferência de Dono", value: "transferOwnership:channel", description: "O Canal onde será enviado as notificações de transferência de dono" },
                        { emoji: emojis.channels, label: "Logs de Aplicações Expiradas", value: "expiredApplication:channel", description: "O Canal onde será enviado as notificações de aplicações expiradas" },
                    ]
                })
            ]),
            CreateRow([
                CreateButton({ label: "Atualizar o painel", style: 1, customId: `config-logs:${storeId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: `advanced-config:${storeId}`, emoji: emojis.back})
            ])
        ]

        await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
    }
})

new InteractionHandler({
    customId: "config-logs-select",

    run: async (client, interaction, storeId, value, option: any) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (value === "show-select-channel" && interaction.isAnySelectMenu()){

            const selectedOption = interaction.values[0];
            const type = selectedOption.split(":")[1];
            const components = [] as ActionRowBuilder[];

            const contents = [
                `# Configurações de Logs`,
            ];

            if (type === "role"){
                components.push(CreateRow([
                    new CreateSelect().RoleSelectMenuBuilder({
                        customId: `config-logs-select:${storeId}:submit-select:${selectedOption}`,
                        placeholder: "Selecione um cargo",
                    })
                ]));
            }

            if (type === "channel"){
                components.push(CreateRow([
                    new CreateSelect().ChannelSelectMenuBuilder({
                        customId: `config-logs-select:${storeId}:submit-select:${selectedOption}`,
                        placeholder: "Selecione um canal",
                        type: ChannelType.GuildText,
                    })
                ]));
            }

            if (type === "category"){
                components.push(CreateRow([
                    new CreateSelect().ChannelSelectMenuBuilder({
                        customId: `config-logs-select:${storeId}:submit-select:${selectedOption}`,
                        placeholder: "Selecione uma categoria",
                        type: ChannelType.GuildCategory,
                    })
                ]));
            }

            components.push(
                CreateRow([
                    CreateButton({ label: "Remover", style: 4, customId: `config-logs-remove-config:${storeId}:${selectedOption}`, emoji: emojis.trash}),
                    CreateButton({ label: "Cancelar", style: 2, customId: `config-logs:${storeId}`, emoji: emojis.cancel})
                ])
            );

            return (interaction as any).update(V2Reply(contents.join("\n"), components));
        }

        if (value === "submit-select" && interaction.isAnySelectMenu()){

            const hasPermissionAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
            if (!hasPermissionAdmin){
                return await interaction.reply({ content: "`❌`・Você precisa da permissão de administrador para publicar a mensagem", flags: 64 });
            }

            const selectedChannel = interaction.values[0];

            // dentro de value da db, vou por um array de objeto com o nome da log e ID do canal
            const currentConfig = await databases.stores.findOne({ _id: storeId });
            const logs = currentConfig?.logsAndRoles || {} as any;

            logs[option] = selectedChannel;
            await databases.stores.findOneAndUpdate({ _id: storeId }, { $set: { logsAndRoles: logs } });

            await client.invokeInteraction(`config-logs:${storeId}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Canal de logs alterado com sucesso", flags: 64 });
        }
    }
});

new InteractionHandler({
    customId: "config-logs-remove-config",

    run: async (client, interaction, storeId, value) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const settings = await databases.stores.findOne({ _id: storeId });
        if (!settings){
            return await interaction.reply({ content: "`❌`・Loja não encontrada", flags: 64 });
        }

        await databases.stores.updateOne(
            { _id: storeId },
            { $set: { [`logsAndRoles.${value}`]: null } }
        );

        await client.invokeInteraction(`config-logs:${storeId}`, interaction);
        await interaction.followUp({ content: "`✅`・Configuração removida com sucesso", flags: 64 });
    }
})
