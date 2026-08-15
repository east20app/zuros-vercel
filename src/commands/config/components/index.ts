import { CreateButton, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";
import { ChartType, emojis, generateChartBuffer, getUserHasPermissionOnStore, PermissionsStore, V2Reply } from "@root/src/functions";
import { AttachmentBuilder } from "discord.js";

import databases from "@root/src/databases";
import CamposCloudSDK from "@camposcloud/sdk";
import client from "@root/src/bot-client";
import { Types } from "mongoose";

new InteractionHandler({
    customId: "config-store",

    run: async (_client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const store = await databases.stores.findOne({ _id: storeId });
        if (!store){
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        const contents = [
            `# Configurando lojas`,
            `- Aqui você poderá configurar sua loja \`${store.name}\`\n`,
        ]
 
        const components = [
            CreateRow([
                CreateButton({ label: "Configurar Produtos", style: 1, customId: `config-products:${storeId}`, emoji: emojis.cart}),
                CreateButton({ label: "Configurar Team", style: 1, customId: `config-team:${storeId}`, emoji: emojis.config}),
                CreateButton({ label: "Configurar os Cupons", style: 1, customId: `config-coupons:${storeId}`, emoji: emojis.cupom}),
            ]),
            CreateRow([
                CreateButton({ label: "Configurações Avançadas", style: 2, customId: `advanced-config:${storeId}`, emoji: emojis.config}),
                CreateButton({ label: "Aplicações Hospedadas", style: 2, customId: `apps-hosted:${storeId}`, emoji: emojis.user}),
                CreateButton({ label: "Atualizar painel", style: 2, customId: `config-store:${storeId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: "config", emoji: emojis.back})
            ])
        ]

        const salesCounts = await databases.applications.aggregate([
             {
                $match: {
                    storeId: new Types.ObjectId(storeId),
                }
            },
            {
                $group: {
                    _id: "$productId",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Transformar para Map
        const salesCountMap = new Map<string, number>();
        for (const item of salesCounts) {
            salesCountMap.set(item._id.toString(), item.count);
        }

        // Buscar somente os campos necessários dos produtos
        const products = await databases.products.find({ storeId }, { name: 1 });

        const chartData = {
            labels: products.map(product => product.name),
            values: products.map(product => salesCountMap.get(product._id.toString()) || 0)
        };

        const canvasChartBuffer = await generateChartBuffer({ labels: chartData.labels, values: chartData.values, type: ChartType.BAR, borderRadius: 4, width: 500, height: 300});
        const attachment = new AttachmentBuilder(canvasChartBuffer, {name: "chart.png"});

        await (interaction as any).update(V2Reply(contents.join("\n"), components, { files: [attachment] }));
    }
})

new InteractionHandler({
    customId: "config-team",

    run: async (_client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const userInfo = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        if (!userInfo) {
            return interaction.reply({ content: "`❌`・Você não está cadastrado!", flags: 64 });
        }

        const store = await databases.stores.findOne({ _id: storeId });
        if (!store) {
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        const ownerStoreData = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos });
        if (!ownerStoreData) {
            return interaction.reply({ content: "`❌`・Dono da loja não encontrado!", flags: 64 });
        }

        const token_campos = ownerStoreData.settings?.token_campos;
        if (!token_campos) {
            return interaction.reply({ content: "`❌`・Token da loja não encontrado!", flags: 64 });
        }

        const sdk = new CamposCloudSDK({ apiToken: token_campos });
        if (!sdk) {
            return interaction.reply({ content: "`❌`・SDK não inicializado corretamente!", flags: 64 });
        }

        const me = await sdk.getMe().catch(() => null);
        if (!me) {
            return interaction.reply({ content: "`❌`・Não foi possível obter os dados do usuário!", flags: 64 });
        }

        const teams = await sdk.getTeams().catch(() => null);
        if (!teams) {
            return interaction.reply({ content: "`❌`・Não foi possível obter as equipes!", flags: 64 });
        }

        const contents = [
            `# Configurando Team`,
            `- Aqui você poderá configurar a equipe da loja \`${store.name}\`\n`,
            `- -# A configuração do team adiciona automaticamente todo BOT adquirido pelo seus cliente à equipe escolhida, facilitando o gerenciamento centralizado.`,
            "> -# A configuração do team é opcional."
        ];

        const components = [
            CreateRow([
                CreateButton({ label: "Atualizar painel", style: 1, customId: `config-team:${storeId}`, emoji: emojis.reload }),
                CreateButton({ label: "Voltar", style: 2, customId: `config-store:${storeId}`, emoji: emojis.back })
            ])
        ];

        if (teams.length){
            const options = teams.map(team => {
                return {
                    label: team.name,
                    value: team._id,
                    description: `Team ID: ${team._id}`,
                    emoji: team._id === store.teamId_campos ? "🟢" : "🔴"
                }
            })

            components.unshift(CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `select-team:${storeId}`,
                    placeholder: "Selecione um team",
                    options,
                    getValueInLastParam: true
                })
            ]));
        }else{
            contents.push(`\n> Você não possui nenhum team criado, crie um no [painel](<https://www.camposcloud.com/dashboard/teams>) da CamposCloud.`);
        }

        return (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [], flags: 64 });
    }
})

new InteractionHandler({
    customId: "select-team",

    run: async (_client, interaction, storeId, teamId) => {
        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const userInfo = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        if (!userInfo) {
            return interaction.reply({ content: "`❌`・Você não está cadastrado!", flags: 64 });
        }

        const store = await databases.stores.findOne({ _id: storeId });
        if (!store) {
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        if (store.teamId_campos === teamId) {
            await databases.stores.updateOne({ _id: storeId }, { teamId_campos: null });
        }else{
            await databases.stores.updateOne({ _id: storeId }, { teamId_campos: teamId });
        }

        await client.invokeInteraction(`config-team:${storeId}`, interaction);
        return interaction.followUp({ content: "`✅`・Team atualizado com sucesso!", flags: 64 });
    }
})
