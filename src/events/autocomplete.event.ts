import client from "../bot-client";
import databases from "../databases";
import { checkRateLimit } from "../functions";
import mongoose from "mongoose";

const MAX_CHOICES = 25;

/** Case-insensitive "contains" filter against what the user has typed so far. */
const filterByQuery = <T extends { name: string }>(items: T[], query: string) => {
    if (!query) return items;
    const normalized = query.trim().toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(normalized));
};

const notFound = (message: string) => [{ name: message, value: "not_found" }];

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isAutocomplete()) return;

    try {
        if (interaction.commandName === "apps") {
            const focused = interaction.options.getFocused(true);

            if (focused.name === "store") {
                if (!checkRateLimit(`apps-autocomplete:${interaction.user.id}`, { windowMs: 5000, maxRequests: 10 })) {
                    return interaction.respond([]);
                }

                const userApplications = await databases.applications
                    .find({ ownerId: interaction.user.id })
                    .populate("storeId", "name")
                    .lean();

                if (!userApplications || userApplications.length === 0) {
                    return interaction.respond(notFound("❌ Você não possui aplicação em nenhuma loja."));
                }

                const storeList: { name: string; value: string }[] = [];
                for (const app of userApplications) {
                    const store = app.storeId as unknown as { name: string; _id: mongoose.Types.ObjectId } | null;
                    if (store && !storeList.some(s => s.value === store._id.toString())) {
                        storeList.push({ name: store.name, value: store._id.toString() });
                    }
                }

                const filtered = filterByQuery(storeList, String(focused.value ?? ""));
                return interaction.respond(filtered.slice(0, MAX_CHOICES));
            }
        }

        if (interaction.commandName === "enviar-release") {
            const focused = interaction.options.getFocused(true);

            if (focused.name === "store") {
                if (!checkRateLimit(`release-store-autocomplete:${interaction.user.id}`, { windowMs: 5000, maxRequests: 10 })) {
                    return interaction.respond([]);
                }

                const userData = await databases.userSettings.findOne(
                    { userId_discord: interaction.user.id },
                    { userId_campos: 1 }
                ).lean();

                const stores = await databases.stores.find({
                    $or: [
                        { ownerId_campos: userData?.userId_campos },
                        { "permissions.userId": interaction.user.id }
                    ],
                }, { name: 1, _id: 1 }).lean();

                if (!stores || stores.length === 0) {
                    return interaction.respond(notFound("❌ Nenhuma loja encontrada"));
                }

                const choices = stores.map((s: any) => ({
                    name: s.name,
                    value: s._id.toString()
                }));

                const filtered = filterByQuery(choices, String(focused.value ?? ""));
                return interaction.respond(filtered.slice(0, MAX_CHOICES));
            }

            if (focused.name === "product") {
                const storeIdRaw = interaction.options.get("store")?.value;
                const storeId = storeIdRaw ? String(storeIdRaw) : null;

                if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
                    return interaction.respond(notFound("❌ Selecione uma loja válida primeiro"));
                }

                // Make sure the user actually has access to this store before leaking its product list.
                const userData = await databases.userSettings.findOne(
                    { userId_discord: interaction.user.id },
                    { userId_campos: 1 }
                ).lean();

                const store = await databases.stores.findOne({
                    _id: storeId,
                    $or: [
                        { ownerId_campos: userData?.userId_campos },
                        { "permissions.userId": interaction.user.id }
                    ],
                }, { _id: 1 }).lean();

                if (!store) {
                    return interaction.respond(notFound("❌ Nenhuma loja encontrada"));
                }

                const products = await databases.products.find({ storeId }, { name: 1 }).lean();
                if (!products || products.length === 0) {
                    return interaction.respond(notFound("❌ Nenhum produto encontrado"));
                }

                const choices = products.map((p: any) => ({
                    name: p.name,
                    value: p._id.toString()
                }));

                const filtered = filterByQuery(choices, String(focused.value ?? ""));
                return interaction.respond(filtered.slice(0, MAX_CHOICES));
            }
        }
    } catch (e) {
        console.error("Erro no autocomplete:", e);
        return interaction.respond([]).catch(() => {});
    }
});
