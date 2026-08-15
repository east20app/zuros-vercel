import axios from "axios";
import { ApplicationCommandOptionType } from "discord.js";
import { SlashCommand } from "fast-discord-js";
import { MAX_CERTIFICATE_SIZE, saveEfiCertificate } from "@root/src/integration/certificates";

new SlashCommand({
    name: "enviarcertificado",
    description: "Envia o certificado do banco para receber pagamentos",
    type: 1,
    options: [{ name: "certificado", description: "Certificado EFI", type: ApplicationCommandOptionType.Attachment, required: true }],
    run: async (_client, interaction) => {
        if (!interaction.isChatInputCommand()) return;
        try {
            await interaction.deferReply({ flags: 64 });
            const attachment = interaction.options.get("certificado")?.attachment;
            if (!attachment?.url) throw new Error("O arquivo não foi recebido corretamente.");
            const extension = attachment.name.split(".").pop()?.toLowerCase();
            if (!extension || !["p12", "pfx", "pem"].includes(extension)) throw new Error("Use um certificado .p12, .pfx ou .pem.");
            const response = await axios.get<ArrayBuffer>(attachment.url, { responseType: "arraybuffer", timeout: 60_000, maxContentLength: MAX_CERTIFICATE_SIZE });
            const result = await saveEfiCertificate({ requesterId: interaction.user.id, certificate: Buffer.from(response.data) });
            return interaction.editReply({ content: result.valid ? "`✅`・Certificado enviado e validado com sucesso." : "`⚠️`・Certificado salvo, mas as credenciais EFI não foram validadas." });
        } catch (error: unknown) {
            const content = `\`❌\`・${error instanceof Error ? error.message : "Não foi possível enviar o certificado."}`;
            return interaction.deferred || interaction.replied ? interaction.editReply({ content }) : interaction.reply({ content, flags: 64 });
        }
    },
});
