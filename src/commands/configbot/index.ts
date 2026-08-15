import databases from "@root/src/databases";
import { emojis, formatUptime, V2Reply } from "@root/src/functions";
import acl from "@root/src/functions/acl";
import axios from "axios";
import { ApplicationCommandType } from "discord.js";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler, SlashCommand } from "fast-discord-js";
import { env } from "@root/src/config/env";

new SlashCommand({
    name: "configbot",
    description: "Configurações do BOT",
    type: ApplicationCommandType.ChatInput,

    run: async (client, interaction) => {
        await interaction.deferReply({ flags: 64 });
        return client.invokeInteraction("config-bot", interaction as any);
    }
})

new InteractionHandler({
    customId: "config-bot",
    run: async (client, interaction) => {
        
        const hasPermission = interaction.user.id === env.OWNER_ID
        if (!hasPermission){
            const message = { content: `\`❌\`・Você não tem permissão para acessar essa área` };
            return interaction.deferred || interaction.replied
                ? interaction.editReply(message)
                : interaction.reply({ ...message, flags: 64 });
        }

        const registredUsers = await databases.userSettings.countDocuments();
        const hostedApplications = await databases.applications.countDocuments();
        const createdProducts = await databases.products.countDocuments();
        const openedCarts = await databases.cartsBuy.countDocuments({ status: "opened" });

        const contents = [
            `# Configurações do BOT`,
            `- Aqui você poderá configurar o manager.\n`,
            `- Informações do Processo`,
            `> \`⏳\`・Uptime: \`${formatUptime(client.uptime!)}\``,
            `> \`💾\`・Memória RAM: \`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\`\n`,
            `- Presença`,
            `> \`🏰\`・Servidores: \`${client.guilds.cache.size}\``,
            `> \`👥\`・Usuários : \`${client.users.cache.size}\`\n`,
            `- Estatísticas`,
            `> \`👤\`・Usuários registrados: \`${registredUsers}\``,
            `> \`📦\`・Aplicações hospedadas: \`${hostedApplications}\``,
            `> \`🛒\`・Produtos criados: \`${createdProducts}\``,
            `> \`🛍️\`・Carrinhos abertos: \`${openedCarts}\`\n`,
            `- Selecione uma das opções abaixo para configurar o BOT`
        ]

        const components = [
            CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: "config-bot-[s]",
                    placeholder: "Selecione uma opção",
                    options: [
                        {label: "Avatar", value: "avatar", description: "Configure o avatar do BOT", emoji: emojis.config},
                        {label: "Configurar BIO", value: "bio", description: "Configure a BIO do BOT", emoji: emojis.config},
                        {label: "Configurar Rich Presence", value: "rich-presence", description: "Configure a presença do BOT no servidor", emoji: emojis.config},
                    ],
                    getValueInLastParam: true
                })
            ]),
            CreateRow([
                CreateButton({ label: "Atualizar painel", customId: "config-bot", emoji: emojis.reload}),
                CreateButton({ label: "Voltar ao menu principal", customId: "invoke-config", emoji: emojis.back, style: 2})
            ])
        ]

        if (interaction.isCommand()){
            return interaction.editReply(V2Reply(contents.join("\n"), components));
        }else{
            return await (interaction as any).update({...V2Reply(contents.join("\n"), components), files: []});
        }
    }
})


new InteractionHandler({
    customId: "set-avatar",
    run: async (client, interaction, action) => {

        if (action === "show-modal"){
            const currentAvatar = client.user?.displayAvatarURL();

            const modal = CreateModal({
                title: "Configurar avatar do BOT",
                customId: "set-avatar:submit-modal",
                inputs: [
                    {label: "Novo avatar", required: true, style: 1, placeholder: "URL da imagem", customId: "new-avatar", value: currentAvatar},
                ]
            })

            await modal.show(interaction as any);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            const newAvatar = interaction.fields.getTextInputValue("new-avatar");

            try {
                await client.user?.setAvatar(newAvatar);
                await client.invokeInteraction("config-bot", interaction);
                await interaction.followUp({content: `\`✅\`・Avatar do BOT alterado com sucesso`, flags: 64});
            }catch(e: any){
                return interaction.reply({content: `\`❌\`・${e.message || "Erro não reconhecido"}`, flags: 64});
            }
        }
    }
})

new InteractionHandler({
    customId: "set-bio",
    run: async (client, interaction, action) => {

        const axiosInstance = axios.create({
            baseURL: 'https://discord.com/api/v10',
            headers: {
                Authorization: `Bot ${env.BOT_TOKEN}`
            }
        });

        if (action === "show-modal"){
            const currentBio = await axiosInstance.get('/applications/@me')
                .then(response => response.data)
                .catch(() => "Erro ao buscar BIO");
            
            const modal = CreateModal({
                title: "Configurar BIO do BOT",
                customId: "set-bio:submit-modal",
                inputs: [
                    {label: "Nova BIO", required: true, style: 2, placeholder: "Nova BIO do BOT", customId: "new-bio", value: currentBio.description},
                ]
            })

            await modal.show(interaction as any);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            const newBio = interaction.fields.getTextInputValue("new-bio");

            try {
                await axiosInstance.patch('/applications/@me', { description: newBio });
                await client.invokeInteraction("config-bot", interaction);
                await interaction.followUp({content: `\`✅\`・BIO do BOT alterada com sucesso`, flags: 64});
            }catch(e: any){
                return interaction.reply({content: `\`❌\`・${e.message || "Erro não reconhecido"}`, flags: 64});
            }
        }
    }
})

new InteractionHandler({
    customId: "set-rich-presence",

    run: async (client, interaction, action) => {

        if (action === "show-modal"){
            const currentValuesDB = await databases.globalSettings.findOne({ key: "rich_presences" });
            const currentValues = currentValuesDB?.value || [];

            const modal = CreateModal({
                title: "Configurar Rich Presence",
                customId: "set-rich-presence:submit-modal",
                inputs: [
                    {label: "Presence #1", required: false, style: 1, placeholder: "Jogando Minecraft", customId: "presence-1", value: currentValues[0] || ""},
                    {label: "Presence #2", required: false, style: 1, placeholder: "Jogando Minecraft", customId: "presence-2", value: currentValues[1] || ""},
                    {label: "Presence #3", required: false, style: 1, placeholder: "Jogando Minecraft", customId: "presence-3", value: currentValues[2] || ""},
                    {label: "Presence #4", required: false, style: 1, placeholder: "Jogando Minecraft", customId: "presence-4", value: currentValues[3] || ""},
                    {label: "Presence #5", required: false, style: 1, placeholder: "Jogando Minecraft", customId: "presence-5", value: currentValues[4] || ""},
                ]
            })

            await modal.show(interaction as any);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            const presences = [
                interaction.fields.getTextInputValue("presence-1"),
                interaction.fields.getTextInputValue("presence-2"),
                interaction.fields.getTextInputValue("presence-3"),
                interaction.fields.getTextInputValue("presence-4"),
                interaction.fields.getTextInputValue("presence-5"),
            ].filter(p => p.trim() !== "");

            await databases.globalSettings.updateOne({ key: "rich_presences" }, { value: presences }, { upsert: true });
            await client.invokeInteraction("config-bot", interaction);
            await interaction.followUp({content: `\`✅\`・Rich Presence configurado com sucesso`, flags: 64});
        }
    }
})

new InteractionHandler({
    customId: "config-bot-[s]",
    run: async (client, interaction, value) => {

        if (value === "rich-presence"){
            client.invokeInteraction("set-rich-presence:show-modal", interaction);
            return;
        }

        if (value === "avatar"){
            client.invokeInteraction("set-avatar:show-modal", interaction);
            return;
        }

        if (value === "bio"){
            client.invokeInteraction("set-bio:show-modal", interaction);
            return;
        }

        return interaction.reply({content: `\`❌\`・Opção inválida`, flags: 64});
    }
})
