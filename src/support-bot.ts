import "dotenv/config";
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder,
    GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, StringSelectMenuBuilder,
} from "discord.js";
import databases from "./databases";
import { getPlatformTelemetry } from "./integration/telemetry";
import { formatApplicationStatus, getUserApplicationStatus, listUserApplications, operateUserApplication } from "./support/services/support-application.service";
import type { SupportCategory } from "./support/types";

const token = process.env.SUPPORT_BOT_TOKEN?.trim();
const clientId = process.env.SUPPORT_BOT_CLIENT_ID?.trim();
const supportGuildId = process.env.SUPPORT_GUILD_ID?.trim();
const supportRoleIds = new Set((process.env.SUPPORT_ROLE_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
const adminRoleIds = new Set((process.env.SUPPORT_ADMIN_ROLE_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
if (!token || !clientId) throw new Error("SUPPORT_BOT_TOKEN e SUPPORT_BOT_CLIENT_ID são obrigatórios.");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers], partials: [Partials.Channel] });
const commands = [
    new SlashCommandBuilder().setName("apps").setDescription("Lista suas aplicações adquiridas e ações disponíveis."),
    new SlashCommandBuilder().setName("ticket").setDescription("Abre um atendimento com o suporte.").addStringOption((option) => option.setName("categoria").setDescription("Categoria do atendimento").setRequired(true).addChoices(
        { name: "Problema técnico", value: "technical" }, { name: "Aplicação ou bot", value: "application" }, { name: "Pagamento", value: "payment" }, { name: "Conta e acesso", value: "account" }, { name: "Loja e vendas", value: "store" }, { name: "Sugestão", value: "suggestion" },
    )),
    new SlashCommandBuilder().setName("support-status").setDescription("Mostra o estado das integrações do suporte."),
].map((command) => command.toJSON());

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(token!);
    const route = supportGuildId ? Routes.applicationGuildCommands(clientId!, supportGuildId) : Routes.applicationCommands(clientId!);
    await rest.put(route, { body: commands });
}
function isStaff(interaction: any): boolean { return Boolean(interaction.member?.roles?.cache?.some((role: any) => supportRoleIds.has(role.id) || adminRoleIds.has(role.id))); }
function safeError(error: unknown): string { return error instanceof Error ? error.message.replace(/token|secret|password|mongodb[^\s]*/gi, "dado sensível") : "Não foi possível concluir a operação."; }
function appButtons(appId: string) { return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`support-app:status:${appId}`).setLabel("Atualizar status").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`support-app:start:${appId}`).setLabel("Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`support-app:restart:${appId}`).setLabel("Reiniciar").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`support-app:stop:${appId}`).setLabel("Parar").setStyle(ButtonStyle.Danger),
); }

client.once("ready", async () => { await registerCommands(); console.log(`[SUPPORT BOT] Online como ${client.user?.tag}`); });
client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isChatInputCommand() && interaction.commandName === "apps") {
            await interaction.deferReply({ ephemeral: true });
            const apps = await listUserApplications(interaction.user.id);
            if (!apps.length) return interaction.editReply("Você não possui aplicações adquiridas nesta conta.");
            const menu = new StringSelectMenuBuilder().setCustomId("support-app-select").setPlaceholder("Selecione uma aplicação").addOptions(apps.slice(0, 25).map((app) => ({ label: app.name.slice(0, 100), value: app.id, description: app.productName.slice(0, 100) })));
            return interaction.editReply({ content: `Você possui **${apps.length}** aplicação(ões). Selecione uma para consultar ou operar:`, components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
        }
        if (interaction.isStringSelectMenu() && interaction.customId === "support-app-select") {
            await interaction.deferUpdate();
            const app = await getUserApplicationStatus(interaction.user.id, interaction.values[0]);
            return interaction.editReply({ content: formatApplicationStatus(app), components: [appButtons(app.id)] });
        }
        if (interaction.isButton() && interaction.customId.startsWith("support-app:")) {
            await interaction.deferUpdate();
            const [, operation, applicationId] = interaction.customId.split(":");
            if (operation === "status") { const app = await getUserApplicationStatus(interaction.user.id, applicationId); return interaction.editReply({ content: formatApplicationStatus(app), components: [appButtons(app.id)] }); }
            await operateUserApplication(interaction.user.id, applicationId, operation as "start" | "restart" | "stop");
            const app = await getUserApplicationStatus(interaction.user.id, applicationId);
            return interaction.editReply({ content: `${formatApplicationStatus(app)}\n\nOperação **${operation}** enviada com sucesso.`, components: [appButtons(app.id)] });
        }
        if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
            if (!interaction.guild) return interaction.reply({ content: "Este comando só pode ser usado em um servidor.", ephemeral: true });
            const existing = await databases.supportTickets.findOne({ guildId: interaction.guild.id, userId: interaction.user.id, status: { $in: ["open", "waiting_staff", "waiting_user"] } });
            if (existing) return interaction.reply({ content: `Você já possui um ticket aberto: <#${existing.channelId}>`, ephemeral: true });
            const category = interaction.options.getString("categoria", true) as SupportCategory;
            const parentId = process.env.SUPPORT_CATEGORY_ID?.trim();
            const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`.slice(0, 90), type: ChannelType.GuildText, parent: parentId || undefined, permissionOverwrites: [{ id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] }, { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }, ...[...supportRoleIds].map((id) => ({ id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] as any }))] });
            await databases.supportTickets.create({ guildId: interaction.guild.id, channelId: channel.id, userId: interaction.user.id, category, status: "open" });
            await channel.send({ content: `<@${interaction.user.id}> ${[...supportRoleIds].map((id) => `<@&${id}>`).join(" ")}`, embeds: [new EmbedBuilder().setTitle("Atendimento ZUROS").setDescription("Explique seu problema com detalhes. Nunca envie tokens, senhas ou chaves de API.").addFields({ name: "Categoria", value: category })] });
            return interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
        }
        if (interaction.isChatInputCommand() && interaction.commandName === "support-status") {
            if (!isStaff(interaction)) return interaction.reply({ content: "Apenas a equipe de suporte pode consultar este status.", ephemeral: true });
            const telemetry = getPlatformTelemetry({ severity: "all", service: "all", limit: 10 });
            return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle("Status do suporte").setDescription(`Eventos recentes registrados: **${telemetry.logs?.length || 0}**\nBanco e integrações são verificados durante as operações.`)] });
        }
    } catch (error) {
        const message = safeError(error);
        const response = interaction as any;
        if (response.deferred || response.replied) await response.editReply({ content: `Não foi possível concluir: ${message}`, components: [] }).catch(() => undefined);
        else await response.reply({ content: `Não foi possível concluir: ${message}`, ephemeral: true }).catch(() => undefined);
    }
});

process.on("SIGTERM", () => client.destroy());
process.on("SIGINT", () => client.destroy());
void client.login(token);
