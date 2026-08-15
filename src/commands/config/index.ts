import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import bytes from "bytes";

import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler, SlashCommand } from "fast-discord-js";
import { emojis, V2Reply } from "@root/src/functions";
import databases from "@root/src/databases";
import CamposCloudSDK from "@camposcloud/sdk";

new SlashCommand({
    name: "config",
    description: "Configuração do manager",
    type: 1,

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: 64 });
        return await client.invokeInteraction("config", interaction as any);
    }
})

new InteractionHandler({
    customId: "config",

    run: async (_client, interaction) => {
        
        const userSettings = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const ownerId_discord = userSettings?.userId_discord;

        const sdk = ownerId_discord ? await sdkWrapper.getInstance(ownerId_discord) : null;
        const userDataCampos = sdk ? await sdk.instance.getMe().catch(() => null) : null;
        const planUsage = ownerId_discord ? await sdkWrapper.getPlanUsage(ownerId_discord).catch(() => null) : null;

        const contents = [
            `# Configurando lojas`,
            `- Aqui você poderá configurar suas lojas!\nㅤ`,
        ]
        
        const currentUserPlan = userDataCampos?.currentSubscription?.planReference;
        const expirationDate = userDataCampos?.currentSubscription?.endAt ? new Date(userDataCampos.currentSubscription.endAt) : null;
        
        if (userDataCampos) {
            contents.push(`> Suas informações da [Campos Cloud](<https://camposcloud.com/dashboard/applications>)`);
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

        const storesOptions = [] as { label: string; value: string, description: string, emoji: string }[];

        const stores = await databases.stores.find({
            $or: [
                { ownerId_campos: userDataCampos?._id },
                { "permissions.userId": interaction.user.id }
            ],

        }, { name: 1, _id: 1 }).catch(() => []);

        stores.map(store => {
            storesOptions.push({
                label: store.name,
                value: store._id.toString(),
                description: "Clique para editar",
                emoji: emojis.config
            });
        })

        const components = [
            CreateRow([
                CreateButton({ label: "Adicionar loja", style: 1, customId: "add-store:show-modal", emoji: emojis.add}),
                CreateButton({ label: "Configurar API", style: 1, customId: "config-api:show-modal", emoji: emojis.config}),
                CreateButton({ label: "Configurar Pagamento", style: 1, customId: "config-payment", emoji: emojis.bank}),
                CreateButton({ label: "Atualizar painel", style: 2, customId: "config", emoji: emojis.reload}),
            ])
        ]

        if (storesOptions.length > 0){
            const select = new CreateSelect().StringSelectMenuBuilder({
                customId: "config-store",
                placeholder: "Selecione uma loja",
                getValueInLastParam: true,
                options: storesOptions,
            })

            components.unshift(CreateRow([select]));
        }

        if (interaction.isCommand()){
            return await interaction.editReply(V2Reply(contents.join("\n"), components));
        }else{
            await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] })
        }
    }
})

new InteractionHandler({
    customId: "add-store",

    run: async (client, interaction, action) => {

        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const token_campos = settingsDB?.settings?.["token_campos"];

        if (!settingsDB || !token_campos) {
            return await interaction.reply({ content: `\`❌\`・API não configurada! Clique no botão "Configurar API" antes.`, flags: 64 });
        }

        if (action === "show-modal"){
            const modal = CreateModal({
                customId: "add-store:submit-modal",
                title: "Adicionando loja",
                inputs: [
                    { customId: "store_name", label: "Nome da loja", placeholder: "Digite o nome da sua loja", required: true },
                ]
            })

            modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){

            const store_name = interaction.fields.getTextInputValue("store_name");
            const sdk = new CamposCloudSDK({ apiToken: token_campos });

            const userDataCampos = await sdk.getMe().catch(() => null);
            if (!userDataCampos) {
                return await interaction.reply({ content: `\`❌\`・Ocorreu um erro ao obter os dados do usuário CamposCloud. Verifique o token e tente novamente!`, flags: 64 });
            }
           
            await databases.stores.create({
                ownerId_campos: userDataCampos._id,
                name: store_name,
            })

            await client.invokeInteraction("config", interaction);
            return await interaction.followUp({ content: `\`✅\`・Loja adicionada com sucesso!`, flags: 64 });
        }
    }
})
