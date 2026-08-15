import CamposCloudSDK from "@camposcloud/sdk";
import databases from "@root/src/databases";
import sdkWrapper from "@root/src/functions/camposcloud-sdk";
import { CreateModal, InteractionHandler } from "fast-discord-js";

new InteractionHandler({
    customId: "config-api",

    run: async (client, interaction, action) => {

        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const campos_token = settingsDB?.settings?.["token_campos"];

        if (action === "show-modal") {
            const statusText = campos_token
                ? `\`✅\`・Token configurado: \`${campos_token.substring(0, 8)}...${campos_token.substring(campos_token.length - 4)}\``
                : `\`❌\`・Nenhum token configurado.`;

            const modal = CreateModal({
                title: "Configurar API",
                customId: "config-api:submit-modal",
                inputs: [
                    {label: "API Token", required: false, style: 1, placeholder: campos_token ? "Token configurado (deixe vazio para remover)" : "Cole seu token aqui", customId: "new-api-token", value: ""},
                ]
            })

            modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            const newApiToken = interaction.fields.getTextInputValue("new-api-token");

            if (newApiToken){
                const sdk = new CamposCloudSDK({ apiToken: newApiToken });
                const userData = await sdk.getMe().catch(() => null);
    
                if (!userData) {
                    return await interaction.reply({ content: `\`❌\`・Token inválido, verifique e tente novamente!`, flags: 64 });
                }

                await databases.userSettings.updateMany(
                    { userId_campos: userData._id, userId_discord: { $ne: interaction.user.id } },
                    { $unset: { "settings.token_campos": "", token_campos: "", userId_campos: "" } }
                );

                await databases.userSettings.updateOne(
                    { userId_discord: interaction.user.id },
                    {
                        $set: {
                            "settings.token_campos": newApiToken,
                            userId_campos: userData._id,
                            userId_discord: interaction.user.id
                        }
                    },
                    { upsert: true }
                );
                await databases.userSettings.updateOne({ userId_discord: interaction.user.id }, { $unset: { token_campos: "" } });

                sdkWrapper.clearInstance(interaction.user.id);
            }else{
                await databases.userSettings.updateOne(
                    { userId_discord: interaction.user.id },
                    { $unset: { "settings.token_campos": "", token_campos: "", userId_campos: "" } },
                );

                sdkWrapper.clearInstance(interaction.user.id);
            }

            await client.invokeInteraction("config", interaction);
            return interaction.followUp({ content: "`✅`・Token de API atualizado com sucesso!", flags: 64 });
        }
    }
})
