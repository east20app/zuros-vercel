import axios from "axios";
import { ApplicationCommandOptionType } from "discord.js";
import { SlashCommand } from "fast-discord-js";
import { MAX_RELEASE_FILE_SIZE, publishProductRelease, RELEASE_FILE_TOO_LARGE_MESSAGE } from "@root/src/integration/releases";

new SlashCommand({
    name: "enviar-release",
    description: "Envia uma nova release para um produto",
    type: 1,
    options: [
        { name: "store", description: "Selecione a loja", type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
        { name: "product", description: "Selecione o produto", type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
        { name: "file", description: "Envie o arquivo .zip da release", type: ApplicationCommandOptionType.Attachment, required: true },
    ],
    run: async (_client, interaction) => {
        try {
            if (!interaction.isChatInputCommand()) return;
            await interaction.deferReply({ flags: 64 });
            const storeId = interaction.options.getString("store", true);
            const productId = interaction.options.getString("product", true);
            const file = interaction.options.getAttachment("file", true);
            if (file.size > MAX_RELEASE_FILE_SIZE) throw new Error(RELEASE_FILE_TOO_LARGE_MESSAGE);
            const response = await axios.get<ArrayBuffer>(file.url, {
                responseType: "arraybuffer",
                timeout: 120_000,
                maxContentLength: MAX_RELEASE_FILE_SIZE,
            });
            const result = await publishProductRelease({
                requesterId: interaction.user.id,
                storeId,
                productId,
                fileBuffer: Buffer.from(response.data),
                fileSize: file.size,
            });
            return interaction.editReply({ content: `\`✅\`・Release \`${result.version}\` enviada com sucesso para o produto \`${result.productName}\`!` });
        } catch (error) {
            const message = { content: `\`❌\`・${error instanceof Error ? error.message : "Não foi possível enviar a release."}` };
            return interaction.deferred || interaction.replied
                ? interaction.editReply(message)
                : interaction.reply({ ...message, flags: 64 });
        }
    },
});
