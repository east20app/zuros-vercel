import databases from "@root/src/databases";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import axios from "axios";
import bytes from "bytes";
import efiWrapper from "@root/src/functions/efi_wrapper";
import promisseWrapper from "@root/src/functions/promisse_wrapper";
import crypto from "crypto";
import QRCode from "qrcode";
import { QrCodePix } from 'qrcode-pix';

import { IProducts } from "@root/src/databases/schemas/products";
import { emojis, checkRateLimit, V2Reply } from "@root/src/functions";
import { ApplicationCommandOptionType, AttachmentBuilder, ButtonStyle, GuildEmojiRoleManager, InteractionResponse, Message, TextInputStyle } from "discord.js";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler, SlashCommand } from "fast-discord-js";
import { IStores } from "@root/src/databases/schemas/stores";
import { ICoupons } from "@root/src/databases/schemas/coupons";
import { IApplications } from "@root/src/databases/schemas/applications";
import { renewCartsMessage } from "@root/src/cronjobs";
import { releaseExists, redeployWithNewToken } from "@root/src/functions/hosted-bot";

const RENEW_CART_EXPIRES_MINUTES = 30; 
const PIX_TAX = 1.2;

new SlashCommand({
    name: "apps",
    description: "Liste suas aplicações",
    type: 1,
    options: [
        {
            name: "store",
            description: "Selecione a loja",
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        },
    ],
    run: async (client, interaction) => {

        if (!interaction.isChatInputCommand()) return;
        const storeId = interaction.options.getString("store", true);
        if (!storeId) {
            return interaction.reply({ content: "`❌`・Nenhuma loja selecionada.", flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        return await client.invokeInteraction(`invoke-apps:${storeId}`, interaction as any);
    }
})

new InteractionHandler({
    customId: "invoke-apps",

    run: async (_client, interaction, storeId, appId) => {

        const storeConfig = await databases.stores.findById(storeId).catch(() => null);
        if (!storeConfig) {
            return interaction.editReply({ content: "`❌`・Loja não encontrada." });
        }

        const userApplications = await databases.applications.find({ ownerId: interaction.user.id, storeId: storeConfig._id }).populate("productId");
        if (!userApplications.length){
            return interaction.editReply({ content: "`❌`・Você não possui nenhuma aplicação." });
        }

        const currentApplication = appId ? userApplications.find(app => app._id.toString() === appId) : userApplications[0];
        if (!currentApplication) {
            return interaction.editReply({ content: "`❌`・Aplicação não encontrada." });
        }

        const currentProduct = currentApplication.productId as unknown as IProducts | null;
        if (!currentProduct) {
            return interaction.editReply({ content: "`❌`・O produto desta aplicação foi removido. Contate um administrador para corrigir o vínculo." });
        }

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1 });
        if (!ownerStoreConfig) {
            return interaction.editReply({ content: "`❌`・Loja não encontrada ou você não está cadastrado." });
        }

        const sdk = await sdkWrapper.getInstance(ownerStoreConfig.userId_discord).catch(() => null);
        if (!sdk || !sdk.isValid) {
            return interaction.editReply({ content: "`❌`・Erro ao conectar com o SDK da CamposCloud." });
        }

        const currentAppData = await sdk.instance.getApplication({ appId: currentApplication.appId! }).catch(() => null);

        const selectApplications = userApplications.map(app => {
            const product = app.productId as unknown as IProducts | null;

            return {
                label: app.name,
                value: app.id,
                description: product?.name || "Produto removido",
                emoji: emojis.foldder
            }
        });

        const applicationMetrics = currentAppData?.data.currentResourceMetrics || null;
        const memoryUsedLabel = applicationMetrics?.online ? `${bytes(applicationMetrics?.memoryUsageBytes!, { unitSeparator: " "}) || "0"} / ${bytes(applicationMetrics?.memoryLimitBytes!, { unitSeparator: " " })}` : "N/A";
        
        const statusDict = {
            "active": "Ativo・🟢",
            "grace_period": "Período de carência・🟠",
        }

        const versionLabel = currentProduct.currentReleaseVersion !== currentApplication.version ? "Será atualizado em breve ⚠️" : "🟢";

        const contents = [
            `## ${currentApplication.name}`,
            `- Aqui estão as informações da sua aplicação:`,
            `> Status: \`${applicationMetrics?.online ? "Online・🟢" : "Offline・🔴"}\``,
            `> Memória utilizada: \`${memoryUsedLabel}\``,
            `> Tempo de atividade: ${applicationMetrics?.online ? `<t:${Math.floor(Date.now() / 1000 - applicationMetrics.uptime!)}:R>` : "\`N/A\`"}\n`,
            `> Data de expiração: ${currentApplication.lifetime ? `\`♾️ Lifetime\`` : `<t:${Math.floor((currentApplication.expiresAt?.getTime() || 0) / 1000)}:R>`}`,
            `> Versão: \`v${currentApplication.version}・${currentApplication.errorOnUpdate ? "Erro ao atualizar ⚠️" : versionLabel}\``,
            `> Status: \`${statusDict[currentApplication.status]}\``,
        ]

        const components = [
            CreateRow([
                new CreateSelect()
                    .StringSelectMenuBuilder({ 
                        customId: `invoke-apps:${storeConfig._id}`, 
                        options: selectApplications, 
                        placeholder: "Selecione uma aplicação", 
                        getValueInLastParam: true
                    })
            ]),
            CreateRow([
                CreateButton({ customId: `start-app:${currentApplication._id}`, label: "Iniciar", style: ButtonStyle.Success, emoji: emojis.play, disabled: applicationMetrics?.online }),
                CreateButton({ customId: `restart-app:${currentApplication._id}`, label: "Reiniciar", style: ButtonStyle.Primary, emoji: emojis.reload, disabled: !applicationMetrics?.online }),
                CreateButton({ customId: `stop-app:${currentApplication._id}`, label: "Parar", style: ButtonStyle.Danger, emoji: emojis.square, disabled: !applicationMetrics?.online }),
                CreateButton({ customId: `renew-app:${currentApplication._id}`, label: "Renovar BOT", style: ButtonStyle.Secondary, emoji: emojis.cart, disabled: currentApplication.lifetime }),
            ]),
            CreateRow([
                CreateButton({ customId: `settings-app:${currentApplication._id}`, label: "Configurações", style: ButtonStyle.Secondary, emoji: emojis.config }),
                CreateButton({ customId: `invoke-apps:${storeId}:${currentApplication._id}`, label: "Atualizar painel", style: ButtonStyle.Secondary, emoji: emojis.reload }),
                CreateButton({ label: "Adicionar no Servidor", style: ButtonStyle.Link, url: `https://discord.com/api/oauth2/authorize?client_id=${currentApplication.botId}&permissions=8&scope=bot%20applications.commands`, customId: ``, emoji: emojis.user}),
            ])
        ]

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply({ ...V2Reply(contents.join("\n"), components), files: [] });
        }else if (interaction.isCommand()){
            return interaction.reply({ ...V2Reply(contents.join("\n"), components), flags: 64 });
        }else{
            return (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
        }
    }
})

new InteractionHandler({
    customId: "settings-app",

    run: async (client, interaction, appId) => {
        const application = await databases.applications.findById(appId).populate("productId");
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        const product = application.productId as unknown as IProducts;

        const components = [
            CreateRow([
                CreateButton({ customId: `change-token:${appId}:show-modal`, label: "Alterar token", style: ButtonStyle.Primary, emoji: emojis.settings }),
                CreateButton({ customId: `change-name:${appId}:show-modal`, label: "Alterar nome", style: ButtonStyle.Secondary, emoji: emojis.settings }),
                CreateButton({ customId: `select-server:${appId}:show-modal`, label: "Servidor Principal", style: ButtonStyle.Secondary, emoji: emojis.foldder }),
                CreateButton({ customId: `settings-app:${appId}`, label: "Atualizar painel", style: ButtonStyle.Secondary, emoji: emojis.reload }),
            ]),
            CreateRow([
                CreateButton({ customId: `invoke-apps:${application.storeId}:${application._id}`, label: "Voltar", style: ButtonStyle.Secondary, emoji: emojis.back }),
            ]),
        ];

        const statusDict = {
            "active": "Ativo・🟢",
            "grace_period": "Período de carência・🟠",
        }

        const versionLabel = product.currentReleaseVersion !== application.version ? "Será atualizado em breve ⚠️" : "🟢";

        const contents = [
            `## Configurações da Aplicação: ${application.name}`,
            `- Nome do Produto: \`${product.name}\``,
            `- ID do Produto: \`${product._id}\`\n`,
            `- ID da Aplicação: \`${application.appId}\``,
            `- ID do Bot: \`${application.botId}\`\n`,
            `- Data de expiração: ${application.lifetime ? "`♾️ Lifetime`" : `<t:${Math.floor((application.expiresAt?.getTime() || 0) / 1000)}:R>`}`,
            `- Versão: \`v${application.version}・${application.errorOnUpdate ? "Erro ao atualizar ⚠️" : versionLabel}\``,
            `- Status: \`${statusDict[application.status]}\``
        ];

        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply(V2Reply(contents.join("\n"), components));
        }else{
            await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "change-token",

    run: async (client, interaction, appId, action) => {
        
        if (action === "submit-modal" && interaction.isModalSubmit()) {
            if (!checkRateLimit(`change-token:${interaction.user.id}`, { windowMs: 15000, maxRequests: 2 })) {
                return interaction.reply({ content: "`❌`・Aguarde alguns segundos antes de alterar o token novamente.", flags: 64 });
            }
        }

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
                customId: `change-token:${appId}:submit-modal`,
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
                        { key: "OWNER_ID", value: interaction.user.id },
                        { key: "APPLICATION_ID", value: String(application._id) },
                        { key: "BOT_ID", value: botInfo.data.id },
                        { key: "API_URL", value: "https://api.droxbot.com.br" },
                        { key: "VERSION", value: String(version) },
                        { key: "DROX_EMOJIS", value: "true" },
                        { key: "SAVE_CONFIG", value: "false" },
                        { key: "START_ON_BACKUP", value: "true" },
                        { key: "SERVER_ID", value: storeConfig.teamId_campos || "" },
                        { key: "PERMS", value: interaction.user.id },
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
                        owner: interaction.user.id,
                        id: botInfo.data.id,
                        perms: interaction.user.id,
                        server: storeConfig.teamId_campos || "",
                    }
                });
                
                await currentApplicationCampos.start().catch(() => null);
                await application.save();

                await client.invokeInteraction(`settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Token alterado com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`settings-app:${appId}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "restart-app",

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
            await client.invokeInteraction(`invoke-apps:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Aplicação reiniciada com sucesso!", flags: 64 });
        }catch (error: any) {
            await client.invokeInteraction(`invoke-apps:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            return;
        }
    }
})

new InteractionHandler({
    customId: "start-app",

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
            await client.invokeInteraction(`invoke-apps:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Aplicação iniciada com sucesso!", flags: 64 });

        }catch (error: any) {
            await client.invokeInteraction(`invoke-apps:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            return;
        }
    }
})

new InteractionHandler({
    customId: "stop-app",

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
            await client.invokeInteraction(`invoke-apps:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: "`✅`・Aplicação parada com sucesso!", flags: 64 });

        }catch (error: any) {
            await client.invokeInteraction(`invoke-apps:${storeConfig._id}:${application._id}`, interaction as any);
            await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            return;
        }
    }
});

new InteractionHandler({
    customId: "change-name",

    run: async (client, interaction, appId, action) => {
        const application = await databases.applications.findById(appId);
        if (!application) {
            return interaction.reply({ content: "`❌`・Aplicação não encontrada.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            const modal = CreateModal({
                title: "Alterar Nome da Aplicação",
                customId: `change-name:${appId}:submit-modal`,
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
                
                await client.invokeInteraction(`settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Nome alterado com sucesso!", flags: 64 });
            }catch (error: any) {
                await client.invokeInteraction(`settings-app:${appId}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "select-server",

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
            try {
                const guildsRes = await axios.get(`https://discord.com/api/v10/users/@me/guilds`, {
                    headers: { Authorization: `Bot ${application.token}` }
                });

                const guilds = guildsRes.data as { id: string; name: string; icon: string | null }[];
                if (!guilds || !guilds.length) {
                    throw new Error("O bot não está em nenhum servidor.");
                }

                const options = guilds.map((g) => ({
                    label: g.name.slice(0, 100),
                    value: g.id,
                    emoji: "🏠",
                }));

                const selectRow = CreateRow([
                    new CreateSelect().StringSelectMenuBuilder({
                        customId: `select-server:${appId}:submit`,
                        placeholder: "Selecione o servidor principal",
                        options: options.slice(0, 25),
                        getValueInLastParam: true,
                    })
                ]);

                const backRow = CreateRow([
                    CreateButton({ customId: `settings-app:${appId}`, label: "Voltar", style: ButtonStyle.Secondary, emoji: emojis.back }),
                ]);

                const contents = [
                    `## Selecionar Servidor Principal`,
                    `- O bot \`${application.name}\` está em **${guilds.length}** servidor(es).`,
                    `- Selecione qual servidor será o **principal** do bot.\n`,
                    `-# O servidor principal é usado como referência pelo bot.`,
                ];

                return interaction.reply({ ...V2Reply(contents.join("\n"), [selectRow, backRow]), flags: 64 });
            } catch (e: any) {
                return interaction.reply({ content: `\`❌\`・${e?.response?.data?.message || e?.message}`, flags: 64 });
            }
        }

        if (action === "submit" && interaction.isAnySelectMenu()) {
            try {
                await interaction.deferUpdate({});
                await interaction.editReply(V2Reply("`🔁`・Alterando servidor principal... ", []));

                const newServerId = interaction.values[0];

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

                const version = application.version || product.currentReleaseVersion;
                if (!version) {
                    throw new Error("Não foi possível determinar a versão da release. Verifique o produto.");
                }

                await releaseExists(String(product._id), String(version)).catch(() => {
                    throw new Error(`Release ${version} do produto não encontrada no disco. Impossível reconstruir o pacote. Contate um administrador.`);
                });

                if (currentApplicationCampos.data.currentResourceMetrics?.online) {
                    await sdkCampos.instance.stopApplication({ appId: application.appId! }).catch(() => null);
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
                        { key: "OWNER_ID", value: application.ownerId },
                        { key: "APPLICATION_ID", value: String(application._id) },
                        { key: "BOT_ID", value: application.botId },
                        { key: "API_URL", value: "https://api.droxbot.com.br" },
                        { key: "VERSION", value: String(version) },
                        { key: "DROX_EMOJIS", value: "true" },
                        { key: "SAVE_CONFIG", value: "false" },
                        { key: "START_ON_BACKUP", value: "true" },
                        { key: "SERVER_ID", value: newServerId },
                        { key: "PERMS", value: application.ownerId },
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
                        owner: application.ownerId,
                        id: application.botId,
                        perms: application.ownerId,
                        server: newServerId,
                    }
                });

                await currentApplicationCampos.start().catch(() => null);

                await client.invokeInteraction(`settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: "`✅`・Servidor principal alterado com sucesso!", flags: 64 });
            } catch (error: any) {
                await client.invokeInteraction(`settings-app:${application._id}`, interaction as any);
                await interaction.followUp({ content: `\`❌\`・${error.message}`, flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "renew-app",

    run: async (_client, interaction, appId) => {
        if (!interaction.isButton()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado através de um botão.", flags: 64 });
        }

        if (!checkRateLimit(`renew:${interaction.user.id}`, { windowMs: 10000, maxRequests: 2 })) {
            return interaction.reply({ content: "`❌`・Aguarde alguns segundos antes de criar outro carrinho de renovação.", flags: 64 });
        }

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

        const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1, payment_gateway: 1 });
        if (!ownerStoreConfig) {
            return interaction.reply({ content: "`❌`・Configuração do dono da loja não encontrada.", flags: 64 });
        }

        if (!product.prices || (!product.prices.weekly && !product.prices.biweekly && !product.prices.monthly && !product.prices.lifetime)){
            return interaction.reply({ content: "`❌`・Este produto não possui preços definidos. Por favor, contate o administrador do servidor.", flags: 64 });
        }

        const cart = await databases.cartsRenew.create({ 
            userId: interaction.user.id,
            channelId: interaction.channelId,
            applicationId: application._id,
            storeId: storeConfig._id,
            expiresAt: new Date(Date.now() + (RENEW_CART_EXPIRES_MINUTES * 60000)),
        })

        if (!cart){
            return interaction.reply({ content: "`❌`・Não foi possível criar o carrinho. Tente novamente mais tarde.", flags: 64 });
        }

        const messageData = await getCartMessageRenew(cart._id.toString());
        const message = await interaction.update(messageData) as unknown as InteractionResponse;
        renewCartsMessage.set(cart._id.toString(), message);
    }
})

new InteractionHandler({
    customId: "select-days-renew",

    run: async (_client, interaction, cartId, selectedValue) => {
        try {
            if (!interaction.isAnySelectMenu()) {
                return;
            }

            const cartRenew = await databases.cartsRenew.findById(cartId);
            if (!cartRenew) {
                throw new Error("Carrinho não encontrado ou expirado. Por favor, tente novamente.");
            }

            const application = await databases.applications.findById(cartRenew.applicationId).populate("productId");
            if (!application) {
                throw new Error("Aplicação não encontrada.");
            }

            const product = application.productId as unknown as IProducts;
            if (!product) {
                throw new Error("Produto não encontrado.");
            }

            let price = 0;

            switch (selectedValue) {
                case "monthly":
                    if (!product.prices?.monthly) throw new Error("Preço mensal não definido para este produto.");
                    price = product.prices.monthly;
                    cartRenew.days = 30;
                    break;
                case "biweekly":
                    if (!product.prices?.biweekly) throw new Error("Preço quinzenal não definido para este produto.");
                    price = product.prices.biweekly;
                    cartRenew.days = 15;
                    break;
                case "weekly":
                    if (!product.prices?.weekly) throw new Error("Preço semanal não definido para este produto.");
                    price = product.prices.weekly;
                    cartRenew.days = 7;
                    break;
                case "lifetime":
                    if (!product.prices?.lifetime) throw new Error("Preço vitalício não definido para este produto.");
                    price = product.prices.lifetime;
                    cartRenew.lifetime = true;
                    break;
                default:
                    throw new Error("Opção de dias inválida selecionada.");
            }

            cartRenew.price = price;
            cartRenew.step = "select-coupons";
            await cartRenew.save();

            const messageData = await getCartMessageRenew(cartRenew._id.toString());
            return await interaction.update(messageData);

        }catch(e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "go-payment-renew",

    run: async (client, interaction, cartId) => {
        try {

            if (!interaction.isButton()){
                throw new Error("Este comando só pode ser usado através de um botão.");
            }

            if (!checkRateLimit(`payment-renew:${interaction.user.id}`, { windowMs: 10000, maxRequests: 2 })) {
                throw new Error("Aguarde alguns segundos antes de gerar outro pagamento.");
            }
    
            const cartRenew = await databases.cartsRenew.findById(cartId).populate("applicationId").populate("storeId").populate("coupon");
            if (!cartRenew) {
                throw new Error("Carrinho não encontrado ou expirado. Por favor, tente novamente.");
            }
    
            const application = cartRenew.applicationId as unknown as IApplications;
            if (!application) {
                throw new Error("Aplicação não encontrada.");
            }
    
            const storeConfig = cartRenew.storeId as unknown as IStores;
            if (!storeConfig) {
                throw new Error("Loja não encontrada.");
            }
    
            const product = await databases.products.findById(application.productId);
            if (!product) {
                throw new Error("Produto não encontrado.");
            }
    
            const ownerStoreConfig = await databases.userSettings.findOne({ userId_campos: storeConfig.ownerId_campos }, { userId_discord: 1, efi_credentials: 1, payment_gateway: 1, manual_payment_credentials: 1, promissepay_credentials: 1 });
            if (!ownerStoreConfig) {
                throw new Error("Configuração do dono da loja não encontrada.");
            }
    
            const coupon = cartRenew.coupon ? cartRenew.coupon as unknown as ICoupons : null;
            const coupomDiscount = (cartRenew.coupon ? coupon?.discount : 0) || 0;

            const priceWithDiscount = cartRenew.price - (cartRenew.price * (coupomDiscount / 100));
            const finalPrice = priceWithDiscount / (1 - (PIX_TAX / 100));

            if (ownerStoreConfig.payment_gateway === "efi") {
                const efiInstance = await efiWrapper.getInstance(ownerStoreConfig.userId_discord);
                if (!efiInstance || !efiInstance.isValid) {
                    throw new Error("Não foi possível conectar-se ao gateway de pagamento. Informe um administrador.");
                }
    
                const txid = crypto.randomBytes(16).toString("hex").slice(0, 26);
                const payment = await efiInstance.instance.pixCreateCharge({txid}, {
                    calendario: {
                        expiracao: 3600,
                    },
                    valor: {
                        original: finalPrice.toFixed(2),
                    },
                    chave: ownerStoreConfig.efi_credentials?.pix_key!
                }).catch((e: any) => console.error(e));
    
                if (!payment) {
                    throw new Error("Não foi possível gerar o pagamento. Informe um administrador.");
                }
    
                const qrCodeDataURL = await QRCode.toDataURL(payment.pixCopiaECola, { errorCorrectionLevel: 'M' });
                const base64Data = qrCodeDataURL.split(',')[1];
    
                cartRenew.pix_qrcode = base64Data;
                cartRenew.pix_copy_and_paste = payment.pixCopiaECola;
                cartRenew.paymentId = payment.txid;
            } else if (ownerStoreConfig.payment_gateway === "manual") {
                const manual_credentials = ownerStoreConfig.manual_payment_credentials;
                if (!manual_credentials || !manual_credentials.pix_key || !manual_credentials.key_type) {
                    throw new Error("O dono da loja não configurou as credenciais de pagamento manual.");
                }

                const qrcode_id = Math.random().toString(36).substring(2, 15);
                const qrCodePix = QrCodePix({
                    version: '01',
                    key: manual_credentials.pix_key,
                    name: 'CamposCloud',
                    city: 'SAO PAULO',
                    transactionId: qrcode_id,
                    message: `Renovação do bot ${cartRenew._id}`,
                    value: finalPrice,
                });

                const qrCodeDataURL = await qrCodePix.base64();
                const base64Data = qrCodeDataURL.split(',')[1];

                cartRenew.pix_qrcode = base64Data;
                cartRenew.pix_copy_and_paste = qrCodePix.payload();
            } else if (ownerStoreConfig.payment_gateway === "promisse") {
                const promisseCredentials = ownerStoreConfig.promissepay_credentials;
                if (!promisseCredentials || !promisseCredentials.api_key) {
                    throw new Error("O dono da loja não configurou as credenciais do PromissePay.");
                }

                const amountInCents = Math.round(finalPrice * 100);
                const transaction = await promisseWrapper.createTransaction(promisseCredentials.api_key, amountInCents);
                if (!transaction) {
                    throw new Error("Não foi possível gerar o pagamento via PromissePay.");
                }

                cartRenew.pix_qrcode = transaction.qrCodeBase64;
                cartRenew.pix_copy_and_paste = transaction.copyPaste;
                cartRenew.paymentId = transaction.id;
            } else {
                throw new Error("O dono da loja não configurou o gateway de pagamento.");
            }

            cartRenew.finalPrice = finalPrice;
            cartRenew.step = "waiting-payment";
            cartRenew.expiresAt = new Date(Date.now() + (RENEW_CART_EXPIRES_MINUTES * 60000));

            await cartRenew.save();
    
            const messageData = await getCartMessageRenew(cartRenew._id.toString());
            await interaction.update(messageData);
        }catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }

    }
})

new InteractionHandler({
    customId: `cancel-renew`,

    run: async (client, interaction, cartId) => {
        if (!interaction.isButton()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado através de um botão.", flags: 64 });
        }

        const cart = await databases.cartsRenew.findById(cartId);
        if (!cart) {
            return interaction.reply({ content: "`❌`・Carrinho não encontrado.", flags: 64 });
        }

        renewCartsMessage.delete(cart._id.toString());
        await cart.updateOne({ status: "cancelled" });

        await client.invokeInteraction(`invoke-apps:${cart.storeId}:${cart.applicationId}`, interaction as any);
        return interaction.followUp({ content: "`✅`・Carrinho cancelado com sucesso.", flags: 64 });
    }
})

new InteractionHandler({
    customId: "add-coupon-renew",

    run: async (client, interaction, cartId, action) => {
        const cart = await databases.cartsRenew.findById(cartId).catch(() => null);
        if (!cart) {
            return interaction.reply({ content: "`❌`・Carrinho não encontrado. Peça pra um administrador excluir pra você.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            try {
                const modal = CreateModal({
                    customId: `add-coupon-renew:${cartId}:submit-modal`,
                    title: "Adicionar Cupom",
                    inputs: [
                        { customId: "coupon-code", label: "Código do Cupom", style: TextInputStyle.Short, required: true, placeholder: "Digite o código do cupom" }
                    ]
                });

                interaction.showModal(modal);
            }catch(e: any) {
                return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
            }
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                const couponCode = interaction.fields.getTextInputValue("coupon-code");
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

                const userRoles = interaction.member?.roles as unknown as GuildEmojiRoleManager;
                if (coupon.roles) {
                    if (!userRoles.cache.some(role => coupon.roles?.includes(role.id))) {
                        const rolesMention = coupon.roles.map(role => `<@&${role}>`).join(", ");
                        throw new Error(`Esse cupom só pode ser utilizado por membros com os cargos: ${rolesMention}`);
                    }
                }

                const application = await databases.applications.findById(cart.applicationId);
                if (!application) {
                    throw new Error("Aplicação não encontrada.");
                }

                if (!application.productId) {
                    throw new Error("Aplicação sem produto vinculado.");
                }
  
                if (coupon.products) {
                    if (!coupon.products.includes(application.productId.toString()) && !coupon.products.includes("all")){
                        throw new Error("Este cupom não é válido para o produto selecionado.");
                    }
                }

                cart.coupon = coupon._id as any;
                await cart.save();

                await databases.coupons.updateOne({ code: couponCode }, { $inc: { remainingUses: -1 } });

                const messageData = await getCartMessageRenew(cart._id.toString());
                await interaction.message?.edit(messageData);

                return interaction.reply({ content: "`✅`・Cupom aplicado com sucesso!", flags: 64 });
            }catch(e: any) {
                return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
            }
        }
        
    }
})

new InteractionHandler({
    customId: "cupom-step-renew",

    run: async (client, interaction, cartId) => {
        try {
            if (!interaction.isButton()) {
                return;
            }

            const cartRenew = await databases.cartsRenew.findById(cartId).catch(() => null);
            if (!cartRenew) {
                throw new Error("Carrinho não encontrado. Peça pra um administrador excluir pra você.");
            }
          
            cartRenew.step = "select-coupons";
            await cartRenew.save();

            const messageData = await getCartMessageRenew(cartRenew._id.toString());
            await interaction.update(messageData);

        } catch (e: any) {
            return interaction.reply({ content: `\`❌\`・${e.message}`, flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "pix-copy-and-paste-renew",

    run: async (_client, interaction, cartId) => {
        if (!interaction.isButton()){
            return interaction.reply({ content: "`❌`・Este comando só pode ser usado através de um botão.", flags: 64 });
        }

        const cartRenew = await databases.cartsRenew.findById(cartId);
        if (!cartRenew) {
            return interaction.reply({ content: "`❌`・Carrinho não encontrado. Peça pra um administrador excluir pra você.", flags: 64 });
        }

        if (!cartRenew.pix_copy_and_paste) {
            return interaction.reply({ content: "`❌`・Código de pagamento não encontrado. Tente gerar um novo código.", flags: 64 });
        }

        return interaction.reply({ content: `${cartRenew.pix_copy_and_paste}`, flags: 64 });
    }
})

export const getCartMessageRenew = async (cartId: string): Promise<any> => {
    const cartRenew = await databases.cartsRenew.findById(cartId).populate("applicationId").populate("storeId").populate("coupon")
    if (!cartRenew) {
        throw new Error("Carrinho não encontrado ou expirado. Por favor, tente novamente.");
    }

    const application = await databases.applications.findById(cartRenew.applicationId).populate("storeId").populate("productId");
    if (!application) {
        throw new Error("Aplicação não encontrada.");
    }

    const storeConfig = cartRenew.storeId as unknown as IStores;
    if (!storeConfig) {
        throw new Error("Loja não encontrada.");
    }

    const product = application.productId as unknown as IProducts;
    if (!product){
        throw new Error("Produto não encontrado.");
    }
    
    const components = []

    const coupon = cartRenew.coupon ? cartRenew.coupon as unknown as ICoupons : null;
    const coupomDiscount = (cartRenew.coupon ? coupon?.discount : 0) || 0;
    const priceWithDiscount = cartRenew.price - (cartRenew.price * (coupomDiscount / 100));

    /**
     * Carrinho expirado, ele vai ser utilizado apenas para informar que o carrinho expirou
     * Será consultado pelo CronJob, ele tem que estar acima das verificação de steps.
     */
    if (cartRenew.status === "expired") {
        const contents = [
            `# Sistema de Compras`,
            `- Carrinho expirado ⏰.`,
            `- Se ainda quiser renovar sua aplicação, crie um novo carrinho.\n`,
        ];

        const components = [
            CreateRow([
                CreateButton({ label: "Voltar para aplicação", style: ButtonStyle.Secondary, customId: `invoke-apps:${storeConfig._id}:${application._id}`, emoji: emojis.back }),
            ])
        ]

        return V2Reply(contents.join("\n"), components);
    }

    if (cartRenew.step === "select-days"){
        const contents = [
            `## Renovação de Aplicação: ${application.name}`,
            `- Olá, ${`<@${application.ownerId}>`}! Você está prestes a renovar sua aplicação **${application.name}**.\n`,
            `- Escolha uma das opções de renovação abaixo para continuar:`
        ]

        const selectDaysOptions = [];
        if (product.prices?.monthly){
            selectDaysOptions.push({ label: "Mensal・30 dias", value: "monthly", description: `R$ ${product.prices.monthly.toFixed(2)}`, emoji: "📆" });
        }

        if (product.prices?.biweekly){
            selectDaysOptions.push({ label: "Quinzenal・15 dias", value: "biweekly", description: `R$ ${product.prices.biweekly.toFixed(2)}`, emoji: "📅" });
        }

        if (product.prices?.weekly){
            selectDaysOptions.push({ label: "Semanal・7 dias", value: "weekly", description: `R$ ${product.prices.weekly.toFixed(2)}`, emoji: "📅" })
        };

        if (product.prices?.lifetime){
            selectDaysOptions.push({ label: "Vitalício", value: "lifetime", description: `R$ ${product.prices.lifetime.toFixed(2)}`, emoji: "♾️" });
        }

        components.push(
            CreateRow([
                new CreateSelect().StringSelectMenuBuilder({ customId: `select-days-renew:${cartRenew._id}`, placeholder: "Selecione os dias", options: selectDaysOptions, getValueInLastParam: true })
            ]),

            CreateRow([
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: `cancel-renew:${cartRenew._id}`, emoji: emojis.cancel }),
            ])
        )

        return V2Reply(contents.join("\n"), components);
    }

    if (cartRenew.step === "select-coupons"){
        const contents = [
            `# Sistema de Compras`,
            `- Olá <@${cartRenew.userId}>, você está renovando o produto **${product.name}**.`,
            `- O preço total da compra é de R$ ${priceWithDiscount.toFixed(2)}.\n`,
        ];

        if (coupon) {
            contents.push(
                `- Cupom aplicado com sucesso!`,
                `> - Código: **${coupon.code}** ( ${coupomDiscount}% )`,
                `> - Desconto: R$ ${(cartRenew.price * (coupomDiscount / 100)).toFixed(2)}\n`,
            );
        }else{
            contents.push(`- Você pode adicionar um cupom de desconto ou continuar com a compra.`);
        }

        contents.push(
            `> Seu carrinho expira em <t:${Math.floor(cartRenew.expiresAt.getTime() / 1000)}:R>`,
        )

        components.push(
            CreateRow([
                CreateButton({ label: "Ir para o pagamento", style: ButtonStyle.Success, customId: `go-payment-renew:${cartRenew._id}`, emoji: emojis.cart }),
                CreateButton({ label: "Adicionar cupom", style: ButtonStyle.Primary, customId: `add-coupon-renew:${cartRenew._id}:show-modal`, emoji: emojis.cupom }),
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: `cancel-renew:${cartRenew._id}`, emoji: emojis.cancel }),
            ])
        );

        return V2Reply(contents.join("\n"), components);
    }

    if (cartRenew.step === "waiting-payment" && cartRenew.paymentId && cartRenew.pix_qrcode && cartRenew.finalPrice){
        const contents = [
            `# Sistema de Compras`,
            `- Olá <@${cartRenew.userId}>, você está renovando o produto **${product.name}**.`,
            `- O preço total da compra é de R$ ${priceWithDiscount.toFixed(2)}.\n`,
            `- Status: **Aguardando pagamento.**`,
        ];

        contents.push(
            `> Seu carrinho expira em <t:${Math.floor(cartRenew.expiresAt.getTime() / 1000)}:R>`,
        )

        components.push(
            CreateRow([
                CreateButton({ label: "Pix Copia e Cola", style: ButtonStyle.Primary, customId: `pix-copy-and-paste-renew:${cartId}`, emoji: emojis.copy }),
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: `cancel-renew:${cartId}`, emoji: emojis.cancel }),
            ])
        );

        const buffer_base_64 = Buffer.from(cartRenew.pix_qrcode!, "base64");
        const attachment = new AttachmentBuilder(buffer_base_64, { name: "payment.png" });

        return V2Reply(contents.join("\n"), components, { files: [attachment] });
    }

    /**
     * Essa parte será usada quando o pagamento foi aprovado.
     * o Cronjob de aprovação de pagamento irá utilizar o modelo abaixo para editar a mensagem,.
     */
    if (cartRenew.step === "payment-confirmed"){
        const contents = [
            `# Sistema de Compras`,
            `- Produto **${product.name}** renovado com sucesso 🥳!`,
            `- Status: **Pagamento aprovado!**\n`,
            `- Você já pode utiliza-la normalmente.\n`,
        ];

        const components = [
            CreateRow([
                CreateButton({ label: "Voltar para aplicação", style: ButtonStyle.Secondary, customId: `invoke-apps:${storeConfig._id}:${application._id}`, emoji: emojis.back }),
            ])
        ]

        return { ...V2Reply(contents.join("\n"), components), files: [] };
    }

    return V2Reply(
        "`❌`・Etapa inválida.",
        [
            CreateRow([
                CreateButton({ label: "Cancelar carrinho", style: ButtonStyle.Danger, customId: "cancel-cart", emoji: emojis.cancel }),
            ])
        ]
    )
}
