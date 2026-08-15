import client from "@root/src/bot-client";
import databases from "@root/src/databases";
import { IProducts } from "@root/src/databases/schemas/products";
import { IStores } from "@root/src/databases/schemas/stores";
import { emojis, getRemainingTimeFormated, getUserHasPermissionOnStore, PermissionsStore, V2Reply } from "@root/src/functions";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import { releaseExists, redeployWithNewToken } from "@root/src/functions/hosted-bot";
import PageSystem from "@root/src/functions/pages";
import axios from "axios";
import bytes from "bytes";
import { ButtonStyle } from "discord.js";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";

new InteractionHandler({
    customId: "apps-hosted",

    run: async (_client, interaction, storeId, _page) => {
        try {

            const page = _page ? Number(_page) : 1;
            if (isNaN(page) || page < 0) {
                throw new Error("Número da página inválido.");
            }
    
            const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
            if (!hasPermission) {
                throw new Error("Você não tem permissão para usar este comando.");
            }
    
            const store = await databases.stores.findOne({ _id: storeId });
            if (!store){
                throw new Error("Loja não encontrada!");
            }
    
            const applications = await databases.applications.find({ storeId }, { name: 1, productName: 1, status: 1, expiresAt: 1, ownerId: 1, lifetime: 1 }).populate("productId", { name: 1 });
            const selectOptions = [];
    
            const contents = [
                `# Aplicações Hospedadas `,
                `- Aqui estão listadas todas as aplicações hospedadas na loja ${store.name}.\n`,
                `- Total de aplicações hospedadas: \`${applications.length}\`\n`,
                `- **Leganda dos emojis:**`,
                `  - \`♾️\`・Vitalício`,
                `  - \`🟢\`・Ativa`,
                `  - \`🟠\`・Período de carência\nㅤ`,
            ];
    
            for (const application of applications){
                
                const applicationProduct = application.productId as unknown as IProducts;
                const owner = client.users.cache.get(application.ownerId);
                let expiresString = "";
    
                if (application.lifetime){
                    expiresString = "Vitalício";
                }else{
                    expiresString = getRemainingTimeFormated(application.expiresAt!);
                }
    
                let emoji = ""
                switch (application.status) {
                    case "active":
                        if (application.lifetime){
                            emoji = "♾️"
                        }else{
                            emoji = "🟢"
                        }
                        break;
                    case "grace_period":
                        emoji = "🟠"
                        break;
                    default:
                        emoji = "⚠️";
                }
    
                selectOptions.push({
                    label: `${application.name}・${applicationProduct?.name} ( ${owner?.username || "Desconhecido"} )`.slice(0, 50),
                    description: `Expira em: ${expiresString}`,
                    value: application._id.toString(),
                    emoji: emoji
                });
            }
    
            const pageSystem = new PageSystem({data: selectOptions, maxItemPerPage: 25});
    
            const components = [
                CreateRow([
                    ...(selectOptions.length ? [
                        CreateButton({ label: " ", emoji: "⬅️", style: 1, customId: `apps-hosted:${storeId}:${page - 1}`, disabled: page <= 1 }),
                        CreateButton({ label: `Pagina ${page}/${pageSystem.totalPages}`, style: 2, customId: `N/A`, disabled: true }),
                        CreateButton({ label: " ", emoji: "➡️", style: 1, customId: `apps-hosted:${storeId}:${page + 1}`, disabled: page >= pageSystem.totalPages }),
                    ] : []),
                    CreateButton({ label: "Atualizar painel", style: 2, customId: `apps-hosted:${storeId}`, emoji: emojis.reload }),
                    CreateButton({ label: "Voltar", style: 2, customId: `config-store:${storeId}`, emoji: emojis.back })
                ])
            ];
                
            if (selectOptions.length) {        
                components.unshift(
                    CreateRow([
                        new CreateSelect().StringSelectMenuBuilder({ customId: `select-app-hosted:${storeId}`, placeholder: "Selecione uma aplicação para gerenciar", options: pageSystem.getPage(page), getValueInLastParam: true })
                    ]),
                )
            }
    
            if (interaction.replied || interaction.deferred) {
                return interaction.editReply({ ...V2Reply(contents.join("\n"), components), files: [] });
            }else{
                return (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
            }

        } catch (error: any) {
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ content: `\`❌\`・${error.message}`, components: [] });
            }else{
                return (interaction as any).reply({ content: `\`❌\`・${error.message}`, components: [], flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "select-app-hosted",

    run: async (_client, interaction, storeId, applicationId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const store = await databases.stores.findOne({ _id: storeId });
        if (!store){
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        const application = await databases.applications.findOne({ _id: applicationId, storeId }, {  }).populate("productId", { name: 1, currentReleaseVersion: 1});
        if (!application){
            return interaction.reply({ content: "`❌`・Aplicação não encontrada!", flags: 64 });
        }

        const product = application.productId as unknown as IProducts;
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado.", flags: 64 });
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
        if (!ownerStoreConfig){
            return interaction.reply({ content: "`❌`・Configuração da loja não encontrada. Por favor, conecte sua conta CamposCloud na loja.", flags: 64 });
        }

        const sdk = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
        if (!sdk || !sdk.isValid) {
            return interaction.reply({ content: "`❌`・Erro ao conectar com o SDK da CamposCloud.", flags: 64 });
        }

        const currentAppData = await sdk.instance.getApplication({ appId: application.appId! }).catch(() => null);

        const applicationMetrics = currentAppData?.data.currentResourceMetrics || null;
        const memoryUsedLabel = applicationMetrics?.online ? `${bytes(applicationMetrics?.memoryUsageBytes!, { unitSeparator: " "}) || "0"} / ${bytes(applicationMetrics?.memoryLimitBytes!, { unitSeparator: " " })}` : "N/A";

        const statusDict = {
            "active": "Ativa 🟢",
            "grace_period": "Período de carência 🟠",
        }

        const versionLabel = product.currentReleaseVersion !== application.version ? "Será atualizado em breve ⚠️" : "🟢";

        const contents = [
            `## ${application.name}`,
            `- Aqui estão as informações da sua [aplicação](<https://www.camposcloud.com/dashboard/applications/${application.appId}>):`,
            `> Status: \`${applicationMetrics?.online ? "Online 🟢" : "Offline 🔴"}\``,
            `> Memória utilizada: \`${memoryUsedLabel}\``,
            `> Tempo de atividade: ${applicationMetrics?.online ? `<t:${Math.floor(Date.now() / 1000 - applicationMetrics.uptime!)}:R>` : "\`N/A\`"}\n`,
            `> Data de expiração: ${application.lifetime ? `\`♾️ Lifetime\`` : `<t:${Math.floor((application.expiresAt?.getTime() || 0) / 1000)}:R>`}`,
            `> Versão: \`v${application.version}・${application.errorOnUpdate ? "Erro ao atualizar ⚠️" : versionLabel}\``,
            `> Status: \`${statusDict[application.status]}\``,
        ]

        const components = [
            CreateRow([
                CreateButton({ customId: `admin-store-start-app:${application._id}`, label: "Iniciar", style: ButtonStyle.Success, emoji: emojis.play, disabled: applicationMetrics?.online }),
                CreateButton({ customId: `admin-store-restart-app:${application._id}`, label: "Reiniciar", style: ButtonStyle.Primary, emoji: emojis.reload, disabled: !applicationMetrics?.online }),
                CreateButton({ customId: `admin-store-stop-app:${application._id}`, label: "Parar", style: ButtonStyle.Danger, emoji: emojis.square, disabled: !applicationMetrics?.online }),
                CreateButton({ customId: `admin-store-settings-app:${application._id}`, label: "Configurações Avançadas", style: ButtonStyle.Secondary, emoji: emojis.config }),
            ]),
            CreateRow([
                CreateButton({ customId: `select-app-hosted:${storeId}:${application._id}`, label: "Atualizar painel", style: ButtonStyle.Secondary, emoji: emojis.reload }),
                CreateButton({ customId: `apps-hosted:${storeId}`, label: "Voltar", style: ButtonStyle.Secondary, emoji: emojis.back }),
            ]),
        ]

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply({ ...V2Reply(contents.join("\n"), components), files: [] });
        }else{
            return (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
        }    
    }
})

new InteractionHandler({
    customId: "admin-store-settings-app",

    run: async (client, interaction, appId) => {
        try {

            const application = await databases.applications.findById(appId).populate("storeId").populate("productId");
            if (!application) {
                throw new Error("Aplicação não encontrada.");
            }
    
            const storeConfig = application.storeId as unknown as IStores;
            if (!storeConfig) {
                throw new Error("Loja não encontrada.");
            }
    
            const product = application.productId as unknown as IProducts;
            if (!product) {
                throw new Error("Produto não encontrado.");
            }
    
            const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
            if (!hasPermission) {
                throw new Error("Você não tem permissão para usar este comando.");
            }
    
            const components = [
                CreateRow([
                    CreateButton({ customId: `admin-store-change-token:${appId}:show-modal`, label: "Alterar token", style: ButtonStyle.Primary, emoji: emojis.settings }),
                    CreateButton({ customId: `admin-store-change-name:${appId}:show-modal`, label: "Alterar nome", style: ButtonStyle.Primary, emoji: emojis.config }),
                    CreateButton({ customId: `admin-store-transfer-ownership:${appId}:show-modal`, label: "Transferir posse", style: ButtonStyle.Primary, emoji: emojis.user }),
                    CreateButton({ customId: `admin-store-delete-app:${appId}:show-modal`, label: "Deletar aplicação", style: ButtonStyle.Danger, emoji: emojis.trash }),
                ]),
                CreateRow([
                    CreateButton({ customId: `admin-store-change-expiration:${appId}:show-modal`, label: "Alterar vencimento", style: ButtonStyle.Secondary, emoji: emojis.config }),
                    CreateButton({ customId: `admin-store-settings-app:${appId}`, label: "Atualizar painel", style: ButtonStyle.Secondary, emoji: emojis.reload }),
                    CreateButton({ customId: `select-app-hosted:${storeConfig._id}:${application._id}`, label: "Voltar", style: ButtonStyle.Secondary, emoji: emojis.back }),
                ])
            ];
            
            const statusDict = {
                "active": "Ativo 🟢",
                "grace_period": "Período de carência 🟠",
            }

            const versionLabel = product.currentReleaseVersion !== application.version ? "Será atualizado em breve ⚠️" : "🟢";

            const contents = [
                `## Configurações da Aplicação: ${application.name}`,
                `- Produto: \`${product.name}\``,
                `- Data de expiração: ${application.lifetime ? "`♾️ Lifetime`" : `<t:${Math.floor((application.expiresAt?.getTime() || 0) / 1000)}:R>`}\n`,
                `- Versão: \`v${application.version}・${application.errorOnUpdate ? "Erro ao atualizar ⚠️" : versionLabel}\``,
                `- Status: \`${statusDict[application.status]}\``,
            ];
    
            if (interaction.replied || interaction.deferred) {
                return await interaction.editReply(V2Reply(contents.join("\n"), components));
            }else{
                return await (interaction as any).update(V2Reply(contents.join("\n"), components));
            }

        }catch (error: any) {
            if (interaction.replied || interaction.deferred) {
                return await interaction.followUp({ content: `\`❌\`・${error.message}`, components: [], flags: 64 });
            }else{
                return await (interaction as any).reply({ content: `\`❌\`・${error.message}`, components: [], flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "admin-store-restart-app",

    run: async (client, interaction, appId) => {
        if (!interaction.isButton()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado através de um botão.", flags: 64 });
        }

        const application = await databases.applications.findById(appId).populate("storeId")
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (application.status !== "active") {
            return interaction.reply({ content: "`❌`・A aplicação não está ativa. Não é possível reiniciar.", flags: 64 });
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
        if (!ownerStoreConfig) {
            return interaction.reply({ content: "`❌`・Configuração do dono da loja não encontrada.", flags: 64 });
        }

        const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
        if (!sdkCampos || !sdkCampos.isValid) {
            return interaction.reply({ content: "`❌`・Erro ao conectar com o SDK da CamposCloud.", flags: 64 });
        }

        const currentApplicationCampos = await sdkCampos.instance.getApplication({ appId: application.appId! }).catch(() => null);
        if (!currentApplicationCampos) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada no SDK da CamposCloud.", flags: 64 });
        }

        try {
            await interaction.deferUpdate({});
            await interaction.editReply(V2Reply("`🔁`・Reiniciando aplicação... ", []))
            
            if (!currentApplicationCampos.data.currentResourceMetrics?.online) {
                return interaction.followUp({ content: "`❌`・A aplicação não está online. Não é possível reiniciar.", flags: 64 });
            }

            await currentApplicationCampos.restart()
            await client.invokeInteraction(`select-app-hosted:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Aplicação reiniciada com sucesso!", flags: 64 });
        }catch (error: any) {
            await client.invokeInteraction(`select-app-hosted:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            return;
        }
    }
})

new InteractionHandler({
    customId: "admin-store-start-app",

    run: async (client, interaction, appId) => {
        if (!interaction.isButton()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado através de um botão.", flags: 64 });
        }

        const application = await databases.applications.findById(appId).populate("storeId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (application.status !== "active") {
            return interaction.reply({ content: "`❌`・A aplicação não está ativa. Não é possível iniciar.", flags: 64 });
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
        if (!ownerStoreConfig) {
            return interaction.reply({ content: "`❌`・Configuração do dono da loja não encontrada.", flags: 64 });
        }

        const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
        if (!sdkCampos || !sdkCampos.isValid) {
            return interaction.reply({ content: "`❌`・Erro ao conectar com o SDK da CamposCloud.", flags: 64 });
        }

        const currentApplicationCampos = await sdkCampos.instance.getApplication({ appId: application.appId! }).catch(() => null);
        if (!currentApplicationCampos) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada no SDK da CamposCloud.", flags: 64 });
        }

        try {
            await interaction.deferUpdate({});
            await interaction.editReply(V2Reply("`🔁`・Iniciando aplicação... ", []));

            if (currentApplicationCampos.data.currentResourceMetrics?.online) {
                return interaction.followUp({ content: "`❌`・A aplicação já está online.", flags: 64 });
            }
            
            await currentApplicationCampos.start();
            await client.invokeInteraction(`select-app-hosted:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Aplicação iniciada com sucesso!", flags: 64 });

        }catch (error: any) {
            await client.invokeInteraction(`select-app-hosted:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            return;
        }
    }
})

new InteractionHandler({
    customId: "admin-store-stop-app",

    run: async (client, interaction, appId) => {
        if (!interaction.isButton()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado através de um botão.", flags: 64 });
        }

        const application = await databases.applications.findById(appId).populate("storeId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (application.status !== "active") {
            return interaction.reply({ content: "`❌`・A aplicação não está ativa. Não é possível parar.", flags: 64 });
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
        if (!ownerStoreConfig) {
            return interaction.reply({ content: "`❌`・Configuração do dono da loja não encontrada.", flags: 64 });
        }

        const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
        if (!sdkCampos || !sdkCampos.isValid) {
            return interaction.reply({ content: "`❌`・Erro ao conectar com o SDK da CamposCloud.", flags: 64 });
        }

        const currentApplicationCampos = await sdkCampos.instance.getApplication({ appId: application.appId! }).catch(() => null);
        if (!currentApplicationCampos) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada no SDK da CamposCloud.", flags: 64 });
        }

        try {
            await interaction.deferUpdate({});
            await interaction.editReply(V2Reply("`🔁`・Parando aplicação... ", []));

            if (!currentApplicationCampos.data.currentResourceMetrics?.online) {
                return interaction.followUp({ content: "`❌`・A aplicação já está offline.", flags: 64 });
            }

            await currentApplicationCampos.stop();
            await client.invokeInteraction(`select-app-hosted:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Aplicação parada com sucesso!", flags: 64 });

        }catch (error: any) {
            await client.invokeInteraction(`select-app-hosted:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            return;
        }
    }
});

new InteractionHandler({
    customId: "admin-store-change-name",

    run: async (client, interaction, appId, action) => {
        const application = await databases.applications.findById(appId);
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            const modal = CreateModal({
                title: "Alterar Nome da Aplicação",
                customId: `admin-store-change-name:${appId}:submit-modal`,
                inputs: [
                    { label: "Novo Nome", customId: "newName", required: true, placeholder: "Digite o novo nome da aplicação", value: application.name }
                ]
            });

            return interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                const newName = interaction.fields.getTextInputValue("newName")
                if (!newName) {
                    throw new Error("O nome não pode ser vazio.");
                }

                if (newName.length > 40) {
                    throw new Error("O nome não pode ter mais de 40 caracteres.");
                }

                application.name = newName;
                await application.save();
                
                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Nome alterado com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`admin-store-settings-app:${appId}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "admin-store-change-token",

    run: async (client, interaction, appId, action) => {
        
        const application = await databases.applications.findById(appId).populate("storeId").populate("productId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const product = application.productId as unknown as IProducts;
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            const modal = CreateModal({
                title: "Alterar Token da Aplicação",
                customId: `admin-store-change-token:${appId}:submit-modal`,
                inputs: [
                    { label: "Novo Token", customId: "newToken", required: true, placeholder: "Digite o novo token da aplicação", value: application.token }
                ]
            })

            return interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                await interaction.deferUpdate({});
                await interaction.editReply(V2Reply("`🔁`・Alterando token... ", []))

                const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
                if (!ownerStoreConfig) {
                    throw new Error("Configuração do dono da loja não encontrada.");
                }

                const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
                if (!sdkCampos || !sdkCampos.isValid) {
                    throw new Error("Não foi possível conectar com o SDK da CamposCloud.");
                }
                
                const currentApplicationCampos = await sdkCampos.instance.getApplication({ appId: application.appId! }).catch(() => null);
                if (!currentApplicationCampos) {
                    throw new Error("Aplicação não encontrada no SDK da CamposCloud.");
                }

                const newToken = interaction.fields.getTextInputValue("newToken");
                if (!newToken) {
                    throw new Error("O token não pode ser vazio.");
                }

                const botInfo = await axios.get(`https://discord.com/api/v10/applications/@me`, {
                    headers: {
                        contentType: "application/json",
                        Authorization: `Bot ${newToken}`
                    }
                }).catch(() => null);
    
                if (!botInfo || !botInfo.data) {
                    throw new Error("Não foi possível obter informações do bot com o novo token. Verifique se o token está correto e tente novamente.");
                }

                const version = application.version || product.currentReleaseVersion;
                if (!version) {
                    throw new Error("Não foi possível determinar a versão da release. Verifique o produto.");
                }

                await releaseExists(String(product._id), String(version)).catch(() => {
                    throw new Error(`Release ${version} do produto não encontrada no disco. Impossível reconstruir o pacote. Contate um administrador.`);
                });
    
                application.botId = botInfo.data.id;
                application.token = newToken;
                
                if (currentApplicationCampos.data.currentResourceMetrics?.online) {
                    await sdkCampos.instance.stopApplication({ appId: application.appId! }).catch(() => null )
                }

                await currentApplicationCampos.updateApplication({
                    appName: currentApplicationCampos.data.name,
                    memoryMB: currentApplicationCampos.data.allocatedMemoryMB,
                    runtimeEnvironment: (product.runtimeEnvironment?.toLowerCase().includes("node") ? "nodejs" : "python") as "python" | "nodejs",
                    startupCommand: currentApplicationCampos.data.startupCommand,
                    environmentVariables: [
                        { key: "BOT_TOKEN", value: newToken },
                        { key: "BOT_TOKEN_DISCORD", value: newToken },
                        { key: "TOKEN", value: newToken },
                        { key: "DISCORD_TOKEN", value: newToken },
                        { key: "OWNER_ID", value: application.ownerId },
                        { key: "APPLICATION_ID", value: String(application._id) },
                        { key: "BOT_ID", value: botInfo.data.id },
                        { key: "API_URL", value: "https://api.droxbot.com.br" },
                        { key: "VERSION", value: String(version) },
                        { key: "DROX_EMOJIS", value: "true" },
                        { key: "SAVE_CONFIG", value: "false" },
                        { key: "START_ON_BACKUP", value: "true" },
                        { key: "SERVER_ID", value: storeConfig.teamId_campos || "" },
                        { key: "PERMS", value: application.ownerId },
                    ]
                });

                await redeployWithNewToken(currentApplicationCampos, String(product._id), String(version), {
                    botID: botInfo.data.id,
                    botToken: newToken,
                    apiURL: "https://api.droxbot.com.br",
                    version: String(version),
                    syncEmojis: true,
                    saveConfig: false,
                    startOnBackup: true,
                    bot: {
                        token: newToken,
                        owner: application.ownerId,
                        id: botInfo.data.id,
                        perms: application.ownerId,
                        server: storeConfig.teamId_campos || "",
                    }
                });
                
                await currentApplicationCampos.start().catch(() => null);
                await application.save();

                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Token alterado com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "admin-store-transfer-ownership",

    run: async (client, interaction, appId, action) => {
        
        const application = await databases.applications.findById(appId).populate("storeId").populate("productId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            throw new Error("Você não tem permissão para transferir a posse desta aplicação.");
        }

        const product = application.productId as unknown as IProducts;
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            
            const modal = CreateModal({
                title: "Alterar Token da Aplicação",
                customId: `admin-store-transfer-ownership:${appId}:submit-modal`,
                inputs: [
                    { label: "ID do Novo Dono", customId: "newOwnerId", required: true, placeholder: "Digite o ID aqui", value: application.ownerId },
                    { label: "Confirmação", customId: "confirmation", required: true, placeholder: "Digite 'sim' para confirmar" }
                ]
            })

            return interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                await interaction.deferUpdate({});
                await interaction.editReply(V2Reply("`🔁`・Transferindo aplicação... ", []))

                const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
                if (!ownerStoreConfig) {
                    throw new Error("Configuração do dono da loja não encontrada.");
                }

                const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
                if (!sdkCampos || !sdkCampos.isValid) {
                    throw new Error("Não foi possível conectar com o SDK da CamposCloud.");
                }
                
                const currentApplicationCampos = await sdkCampos.instance.getApplication({ appId: application.appId! }).catch(() => null);
                if (!currentApplicationCampos) {
                    throw new Error("Aplicação não encontrada no SDK da CamposCloud.");
                }

                const confirmation = interaction.fields.getTextInputValue("confirmation");
                if (confirmation.toLowerCase() !== "sim") {
                    throw new Error("Você não confirmou a transferência. Digite 'sim' para confirmar.");
                }

                const newOwnerId = interaction.fields.getTextInputValue("newOwnerId");
                if (!newOwnerId) {
                    throw new Error("O ID do novo dono não pode ser vazio.");
                }

                const version = application.version || product.currentReleaseVersion;
                if (!version) {
                    throw new Error("Não foi possível determinar a versão da release. Verifique o produto.");
                }

                await releaseExists(String(product._id), String(version)).catch(() => {
                    throw new Error(`Release ${version} do produto não encontrada no disco. Impossível reconstruir o pacote. Contate um administrador.`);
                });

                if (currentApplicationCampos.data.currentResourceMetrics?.online) {
                    await sdkCampos.instance.stopApplication({ appId: application.appId! }).catch(() => null )
                }

                await currentApplicationCampos.updateApplication({
                    appName: currentApplicationCampos.data.name,
                    memoryMB: currentApplicationCampos.data.allocatedMemoryMB,
                    runtimeEnvironment: (product.runtimeEnvironment?.toLowerCase().includes("node") ? "nodejs" : "python") as "python" | "nodejs",
                    startupCommand: currentApplicationCampos.data.startupCommand,
                    environmentVariables: [
                        { key: "BOT_TOKEN", value: application.token },
                        { key: "BOT_TOKEN_DISCORD", value: application.token },
                        { key: "TOKEN", value: application.token },
                        { key: "DISCORD_TOKEN", value: application.token },
                        { key: "OWNER_ID", value: newOwnerId },
                        { key: "APPLICATION_ID", value: String(application._id) },
                        { key: "BOT_ID", value: application.botId },
                        { key: "API_URL", value: "https://api.droxbot.com.br" },
                        { key: "VERSION", value: String(version) },
                        { key: "DROX_EMOJIS", value: "true" },
                        { key: "SAVE_CONFIG", value: "false" },
                        { key: "START_ON_BACKUP", value: "true" },
                        { key: "SERVER_ID", value: storeConfig.teamId_campos || "" },
                        { key: "PERMS", value: newOwnerId },
                    ]
                });

                await redeployWithNewToken(currentApplicationCampos, String(product._id), String(version), {
                    botID: application.botId,
                    botToken: application.token,
                    apiURL: "https://api.droxbot.com.br",
                    version: String(version),
                    syncEmojis: true,
                    saveConfig: false,
                    startOnBackup: true,
                    bot: {
                        token: application.token,
                        owner: newOwnerId,
                        id: application.botId,
                        perms: newOwnerId,
                        server: storeConfig.teamId_campos || "",
                    }
                });
                
                await currentApplicationCampos.start().catch(() => null);

                await databases.applications.updateOne({ _id: application._id }, { ownerId: newOwnerId });
                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Posse alterada com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({ 
    customId: "admin-store-delete-app",

    run: async (client, interaction, appId, action) => {
        
        const application = await databases.applications.findById(appId).populate("storeId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            
            const modal = CreateModal({
                title: "Deletar Aplicação",
                customId: `admin-store-delete-app:${appId}:submit-modal`,
                inputs: [
                    { label: "Confirmação", customId: "confirmation", required: true, placeholder: "Digite 'sim' para confirmar" }
                ]
            })

            return interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                await interaction.deferUpdate({});
                await interaction.editReply(V2Reply("`🔁`・Deletando aplicação... ", []))

                const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
                if (!ownerStoreConfig) {
                    throw new Error("Configuração do dono da loja não encontrada.");
                }

                const confirmation = interaction.fields.getTextInputValue("confirmation");
                if (confirmation.toLowerCase() !== "sim") {
                    throw new Error("Você não confirmou a deleção. Digite 'deletar' para confirmar.");
                }

                const sdkCampos = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
                if (!sdkCampos || !sdkCampos.isValid) {
                    throw new Error("Não foi possível conectar com o SDK da CamposCloud.");
                }
                
                const currentApplicationCampos = await sdkCampos.instance.getApplication({ appId: application.appId! }).catch(() => null);
                // if (!currentApplicationCampos) {
                //     throw new Error("Aplicação não encontrada no SDK da CamposCloud.");
                // }

                await currentApplicationCampos?.delete();
                await databases.applications.deleteOne({ _id: application._id });

                await client.invokeInteraction(`apps-hosted:${storeConfig._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Aplicação deletada com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "admin-store-change-expiration",

    run: async (client, interaction, appId, action) => {
        
        const application = await databases.applications.findById(appId).populate("storeId").populate("productId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const storeConfig = application.storeId as unknown as IStores;
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada.", flags: 64 });
        }

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeConfig._id.toString(), permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const product = application.productId as unknown as IProducts;
        if (!product) {
            return interaction.reply({ content: "`❌`・Produto não encontrado.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {

            let days = "";
            let hours = "";
            let minutes = "";

            if (!application.lifetime && application.expiresAt) {
                const diffMs = application.expiresAt.getTime() - Date.now();

                if (diffMs > 0) {
                    const totalMinutes = Math.floor(diffMs / 60000);
                    const totalHours = Math.floor(diffMs / 3600000);
                    const totalDays = Math.floor(diffMs / 86400000);

                    days = totalDays.toString();
                    hours = Math.floor(totalHours % 24).toString();
                    minutes = Math.floor(totalMinutes % 60).toString();
                }
            }

            const modal = CreateModal({
                title: "Alterar Vencimento da Aplicação",
                customId: `admin-store-change-expiration:${appId}:submit-modal`,
                inputs: [
                    { label: "Dias até o Vencimento", customId: "daysUntilExpiration", required: false, placeholder: "Digite a quantidade de dias", value: days },
                    { label: "Horas até o vencimento", customId: "hoursUntilExpiration", required: false, placeholder: "Digite a quantidade de horas (opcional)", value: hours },
                    { label: "Minutos até o vencimento", customId: "minutesUntilExpiration", required: false, placeholder: "Digite a quantidade de minutos (opcional)", value: minutes },
                    { label: "Lifetime", customId: "isLifetime", required: true, placeholder: "digite 'sim' para definir como lifetime (vitalício)", value: application.lifetime ? "sim" : "não" }
                ]
            })

            return interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                const daysUntilExpiration = parseInt(interaction.fields.getTextInputValue("daysUntilExpiration")) || 0;
                const hoursUntilExpiration = parseInt(interaction.fields.getTextInputValue("hoursUntilExpiration")) || 0;
                const minutesUntilExpiration = parseInt(interaction.fields.getTextInputValue("minutesUntilExpiration")) || 0;
                const isLifetime = interaction.fields.getTextInputValue("isLifetime");

                const validValues = ["sim", "não"]
                if (!validValues.includes(isLifetime.toLowerCase())) {
                    throw new Error("Por favor, insira 'sim' ou 'não' no campo Lifetime.");
                }
                
                // Validando dias
                if (isNaN(daysUntilExpiration) || daysUntilExpiration < 0) {
                    throw new Error("Por favor, insira um número válido de dias (0 ou mais).");
                }

                if (daysUntilExpiration > 500) {
                    throw new Error(`O número máximo de dias até o vencimento para este produto é 500 dias.`);
                }

                // Validando horas e minutos
                if (Number.isNaN(minutesUntilExpiration) || minutesUntilExpiration < 0 || minutesUntilExpiration > 59) {
                    throw new Error("Por favor, insira um número válido de minutos (0-59).");
                }

                if (Number.isNaN(hoursUntilExpiration) || hoursUntilExpiration < 0 || hoursUntilExpiration > 23) {
                    throw new Error("Por favor, insira um número válido de horas (0-23).");
                }

                // Calculando a data de expiração
                if (isLifetime.toLowerCase() === "sim") {
                    application.lifetime = true;
                    application.expiresAt = undefined;
                    application.status = "active";
                } else {

                    if (daysUntilExpiration === 0 && hoursUntilExpiration === 0 && minutesUntilExpiration === 0) {
                        throw new Error("Por favor, insira pelo menos um valor para dias, horas ou minutos até o vencimento.");
                    }

                    application.status = "active";
                    application.lifetime = false;

                    const newExpiresAt = new Date();

                    if (daysUntilExpiration){
                        newExpiresAt.setDate(newExpiresAt.getDate() + daysUntilExpiration);
                    }
                    if (hoursUntilExpiration) {
                        newExpiresAt.setHours(newExpiresAt.getHours() + hoursUntilExpiration);
                    }
                    if (minutesUntilExpiration) {
                        newExpiresAt.setMinutes(newExpiresAt.getMinutes() + minutesUntilExpiration);
                    }

                    application.expiresAt = newExpiresAt;
                }

                await application.save();
                
                await client.invokeInteraction(`admin-store-settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Vencimento alterado com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`admin-store-settings-app:${appId}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})
