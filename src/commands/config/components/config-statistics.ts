import databases from "@root/src/databases";

import { emojis, getUserHasPermissionOnStore, PermissionsStore, V2Reply } from "@root/src/functions";
import { changeBalance } from "@root/src/functions/extracts";
import { ButtonStyle, TextInputStyle } from "discord.js";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";

new InteractionHandler({
    customId: "sales-statistics",

    run: async (_client, interaction, storeId, page = "1") => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const currentPage = parseInt(page);
        const pageSize = 10;
        const skip = (currentPage - 1) * pageSize;

        // Buscar apenas o valor do saldo
        const storeConfig = await databases.stores.findOne({ _id: storeId },  { balance: 1, _id: 1 }).lean();
        if (!storeConfig) {
            return interaction.reply({ content: "`❌`・Loja não encontrada!", flags: 64 });
        }

        const balance = storeConfig?.balance;

        // Contar total de extratos (para saber o total de páginas)
        const totalExtracts = await databases.extracts.countDocuments({ storeId: storeId });

        const totalPages = Math.max(1, Math.ceil(totalExtracts / pageSize));

        // Buscar extratos paginados com apenas os campos necessários
        const extracts = await databases.extracts
            .find({storeId}, { amount: 1, description: 1, action: 1 })
            .sort({ createdAt: -1 }) // opcional: do mais recente pro mais antigo
            .skip(skip)
            .limit(pageSize)
            .lean();

        const contents = [
            "`📊`・Estatísticas de Vendas",
            "`📈`・Visualize as vendas do seu produto e obtenha insights valiosos para impulsionar suas vendas.\n",
            `> Saldo Atual: \`R$ ${(balance || 0).toFixed(2)}\``,
        ];

        const components = [] as any;

        if (extracts.length > 0) {
            components.push(
                CreateRow(
                    new CreateSelect().StringSelectMenuBuilder({
                        customId: `sales-statistics-select:${storeId}`,
                        placeholder: "Selecione uma venda para ver detalhes",
                        options: extracts.map((extract: any, index) => ({
                            label: `R$ ${extract.amount.toFixed(2)}`,
                            value: `${extract._id}`,
                            description: extract?.description?.slice(0, 50),
                            emoji: extract.action === "add" ? "🟢" : "🔴",
                        }))
                    })
                ),
                CreateRow([
                    CreateButton({ label: " ", emoji: "⬅️", customId: `sales-statistics:${storeId}:${currentPage - 1}`, disabled: currentPage <= 1 }),
                    CreateButton({ label: `Página ${currentPage}/${totalPages}`, style: ButtonStyle.Secondary, customId: "dont-click", disabled: true }),
                    CreateButton({ label: " ", emoji: "➡️", customId: `sales-statistics:${storeId}:${currentPage + 1}`, disabled: currentPage >= totalPages }),
                ]),
            );
        }

        components.push(
            CreateRow(
                CreateButton({ label: "Adicionar", customId: `add-balance:${storeId}:show-modal`, style: ButtonStyle.Primary, emoji: emojis.add }),
                CreateButton({ label: "Remover", customId: `remove-balance:${storeId}:show-modal`, style: ButtonStyle.Primary, emoji: emojis.remove }),
                CreateButton({ label: "Atualizar painel", customId: `sales-statistics:${storeId}:${page}`, style: ButtonStyle.Secondary, emoji: emojis.reload }),
                CreateButton({ label: "Voltar", customId: `advanced-config:${storeId}`, style: ButtonStyle.Secondary, emoji: emojis.back }),
            ),
        );

        await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] });
    }
});

new InteractionHandler({
    customId: "add-balance",

    run: async (client, interaction, storeId, action) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            const modal = CreateModal({
                title: "Adicionar Saldo",
                customId: `add-balance:${storeId}:submit-modal`,
                inputs: [
                    { label: "Valor", customId: "amount", placeholder: "Digite o valor a ser adicionado", required: true },
                    { label: "Descrição", customId: "description", placeholder: "Digite uma descrição (opcional)", required: false, style: TextInputStyle.Paragraph },
                ]
            });

            return await interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                const amount = parseFloat(interaction.fields.getTextInputValue("amount").replace(",", "."));
                const description = interaction.fields.getTextInputValue("description") || "Saldo adicionado";

                if (isNaN(amount) || amount <= 0) {
                    return await interaction.reply({ content: "`❌`・Por favor, insira um valor válido para adicionar ao saldo.", flags: 64 });
                }

                await changeBalance({ action: "add", amount, description, origin: "manual", storeId });
                
                await client.invokeInteraction(`sales-statistics:${storeId}`, interaction);
                await interaction.followUp({ content: `\`✅\`・Saldo adicionado com sucesso`, flags: 64 });
            }catch (error) {

                if (interaction.replied) {
                    await interaction.followUp({ content: "`❌`・Ocorreu um erro ao adicionar o saldo.", flags: 64 });
                    return;
                }

                return await interaction.reply({ content: "`❌`・Ocorreu um erro ao adicionar o saldo.", flags: 64 });
            }
        }
    }
});
            
new InteractionHandler({
    customId: "remove-balance",

    run: async (client, interaction, storeId, action) => {
        
        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal" && interaction.isButton()) {
            const modal = CreateModal({
                title: "Remover Saldo",
                customId: `remove-balance:${storeId}:submit-modal`,
                inputs: [
                    { label: "Valor", customId: "amount", placeholder: "Digite o valor a ser removido", required: true },
                    { label: "Descrição", customId: "description", placeholder: "Digite uma descrição (opcional)", required: false, style: TextInputStyle.Paragraph },
                ]
            });

            return await interaction.showModal(modal);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()) {
            try {
                const amount = parseFloat(interaction.fields.getTextInputValue("amount").replace(",", "."));
                const description = interaction.fields.getTextInputValue("description") || "Saldo removido";

                if (isNaN(amount) || amount <= 0) {
                    return await interaction.reply({ content: "`❌`・Por favor, insira um valor válido para remover do saldo.", flags: 64 });
                }

                await changeBalance({ action: "remove", amount, description, origin: "manual", storeId });
                await client.invokeInteraction(`sales-statistics:${storeId}`, interaction);

                await interaction.followUp({ content: `\`✅\`・Saldo removido com sucesso`, flags: 64 });
            } catch (error) {

                if (interaction.replied){
                    await interaction.followUp({ content: "`❌`・Ocorreu um erro ao remover o saldo.", flags: 64 });
                    return;
                }

                return await interaction.reply({ content: "`❌`・Ocorreu um erro ao remover o saldo.", flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "sales-statistics-select",

    run: async (client, interaction, storeId) => {
        if (!interaction.isAnySelectMenu()) return;

        return interaction.reply({ content: "`⚠️`・A funcionalidade de detalhes da venda ainda não está implementada 😴", flags: 64 });
    }

});