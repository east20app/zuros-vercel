import { TextInputStyle } from "discord.js";
import { emojis, getUserHasPermissionOnStore, PermissionsStore, V2Reply } from "@root/src/functions";
import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";

import client from "@root/src/bot-client";
import databases from "@root/src/databases";

new InteractionHandler({
    customId: "config-coupons",

    run: async (client, interaction, storeId) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const coupons = await databases.coupons.find({});
        const contents = [
            `# Configurando cupons`,
            `- Aqui você poderá adicionar, remover e editar cupons!\n`,
        ]

        const components = [
            CreateRow([
                CreateButton({ label: "Adicionar Cupom", style: 1, customId: `config-add-coupon:${storeId}:show-modal`, emoji: emojis.add}),
                CreateButton({ label: "Atualizar Painel", style: 2, customId: `config-coupons:${storeId}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: `config-store:${storeId}`, emoji: emojis.back})
            ])
        ]

        if (coupons.length){
            components.unshift(CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `select-edit-coupons:${storeId}`,
                    options: coupons.map((coupon: any) => ({ label: `Cupom: ${coupon.code}`, value: coupon._id, emoji: emojis.settings, description: "Clique para editar esse cupom" })),
                    placeholder: "Selecione um cupom",
                })
            ]))
        }

        await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] })
    }
})

new InteractionHandler({ 
    customId: "config-add-coupon",

    run: async (_client, interaction, storeId, action) => {
        
        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (action === "show-modal"){
            const modal = CreateModal({
                customId: `config-add-coupon:${storeId}:submit-modal`,
                title: "Adicionando cupom",
                inputs: [
                    { label: "Código do Cupom", placeholder: "Digite o código do cupom", required: true, style: TextInputStyle.Short, customId: "coupon-code" },
                    { label: "Desconto do Cupom", placeholder: "Digite o valor do desconto", required: true, style: TextInputStyle.Short, customId: "coupon-discount" },
                    { label: "Limite de Uso", placeholder: "Digite o limite de uso", required: true, style: TextInputStyle.Short, customId: "usage-limit" },
                    { label: "Expiração em Dias", placeholder: "10", required: true, style: TextInputStyle.Short, customId: "expiration-date" },
                ]                
            })

            return modal.show(interaction as any);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            
            const code = interaction.fields.getTextInputValue("coupon-code");
            const discount = interaction.fields.getTextInputValue("coupon-discount");
            const limit = interaction.fields.getTextInputValue("usage-limit")
            const expirationDays = Number(interaction.fields.getTextInputValue("expiration-date"))

            if (!code || !discount) return await interaction.reply({ content: "`❌`・Por favor, preencha os campos", flags: 64 });

            const existingCoupon = await databases.coupons.findOne({ code });
            if (existingCoupon) return await interaction.reply({ content: "`❌`・Este código de cupom já existe. Por favor, escolha um código diferente.", flags: 64 });

            const parsedDiscount = parseFloat(discount);
            if (isNaN(parsedDiscount)) return await interaction.reply({ content: "`❌`・O desconto precisa ser um número válido.", flags: 64 });
            
            const parsedLimit = limit ? parseInt(limit, 10) : 0;
            if (limit && (isNaN(parsedLimit) || parsedLimit < 0)) return await interaction.reply({ content: "`❌`・O limite de uso precisa ser um número válido.", flags: 64 });

            if (!expirationDays || isNaN(expirationDays) || expirationDays <= 0){
                return await interaction.reply({ content: "`❌`・Por favor, preencha o campo de expiração com um número válido.", flags: 64 });
            }

            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expirationDays);

            await databases.coupons.create({ storeId, code, discount: parsedDiscount, remainingUses: parsedLimit, expiresAt: expirationDate, roles: [], products: [] });
            await client.invokeInteraction(`config-coupons:${storeId}`, interaction);

            await interaction.followUp({ content: "`✅`・Cupom adicionado com sucesso", flags: 64 });
        }
    }
})

new InteractionHandler({
    customId: "select-edit-coupons",

    run: async (client, interaction, storeId) => {
        if (!interaction.isAnySelectMenu()) return;

        return client.invokeInteraction(`edit-coupons:${storeId}:${interaction.values[0]}`, interaction);        
    }
})

new InteractionHandler({
    customId: "edit-coupons",
    
    run: async (_client, interaction, storeId, couponid) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const coupon = await databases.coupons.findOne({ _id: couponid, storeId });
        if (!coupon) return await interaction.reply({ content: "`❌`・Cupom não encontrado", flags: 64 });

        const productIds = coupon.products || [];
        const applicableProducts = await databases.products.find({ _id: { $in: productIds.filter(id => id !== "all") }, storeId });
        const productNames = productIds.includes("all") ? "Todos produtos" : applicableProducts.map(product => product.name).join(', ') || '`Nenhum produto definido`';

        const contents = [
            `# Editando Cupom: ${coupon.code}`,
            `- Aqui você pode atualizar as informações do cupom!\n`,
            
            `\`✏️\`・Código do Cupom: \`${coupon.code}\`\nㅤ`,

            `\`💸\`・Desconto: \`${coupon.discount}%\``,
            `\`🔄\`・Usos Restantes: \`${coupon.remainingUses}\``,
            `\`📅\`・Data de Expiração: \`${coupon.expiresAt.toLocaleDateString()}\`\nㅤ`,

            `\`🎟️\`・Cargos setados: ${(coupon.roles ?? []).map(roleId => `<@&${roleId}>`).join(', ') || '`Nenhum cargo definido`'}`,
            `\`🛒\`・Produtos Aplicáveis: \`${productNames || 'Todos'}\`\nㅤ`
        ];

        const components = [
            CreateRow([
                new CreateSelect().StringSelectMenuBuilder({
                    customId: `edit-coupons-select-option:${storeId}:${couponid}`,
                    placeholder: "Selecione uma opção",
                    options: [
                        { label: "Editar Código do Cupom", value: "code", emoji: emojis.config, description: "Clique para editar o código do cupom" },
                        { label: "Editar Desconto", value: "discount", emoji: emojis.config, description: "Clique para editar o valor do desconto" },
                        { label: "Editar Limite de Uso", value: "usage-limit", emoji: emojis.config, description: "Clique para editar o limite de uso do cupom" },
                        { label: "Editar Data de Expiração", value: "expiration-date", emoji: emojis.config, description: "Clique para editar a data de expiração do cupom" },
                        { label: "Editar Cargos", value: "roles", emoji: emojis.config, description: "Clique para editar cargos para o cupom" },
                        { label: "Editar Produtos", value: "products", emoji: emojis.config, description: "Clique para editar produtos para o cupom" },
                        { label: "Deletar Cupom", value: "delete", emoji: "🗑️", description: "Clique para deletar o cupom" },
                    ]                    
                })
            ]),
            CreateRow([
                CreateButton({ label: "Atualizar Painel", style: 2, customId: `edit-coupons:${storeId}:${couponid}`, emoji: emojis.reload}),
                CreateButton({ label: "Voltar", style: 2, customId: `config-coupons:${storeId}`, emoji: emojis.back})
            ])
        ]

        return await (interaction as any).update({ ...V2Reply(contents.join("\n"), components), files: [] })
    }
})

new InteractionHandler({
    customId: "edit-coupons-select-option",

    run: async (client, interaction, storeId, couponid) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        if (!interaction.isAnySelectMenu()) return;
       
        const option = interaction.values[0];
        const customIdPrefix = `edit-coupon-db:${storeId}:${couponid}`;

        if (option === "code") return client.invokeInteraction(`${customIdPrefix}:code-show-modal`, interaction);
        if (option === "discount") return client.invokeInteraction(`${customIdPrefix}:discount-show-modal`, interaction);
        if (option === "usage-limit") return client.invokeInteraction(`${customIdPrefix}:usage-limit-show-modal`, interaction);
        if (option === "expiration-date") return client.invokeInteraction(`${customIdPrefix}:expiration-date-show-modal`, interaction);
        if (option === "roles") return client.invokeInteraction(`${customIdPrefix}:roles-select-menu`, interaction);
        if (option === "products") return client.invokeInteraction(`${customIdPrefix}:products`, interaction);
        if (option === "delete") return client.invokeInteraction(`${customIdPrefix}:delete-show-confirm-modal`, interaction);
    }
});

new InteractionHandler({
    customId: "edit-coupon-db",

    run: async (client, interaction, storeId, couponid, option, customParam) => {

        const hasPermission = await getUserHasPermissionOnStore({ userId: interaction.user.id, storeId: storeId, permission: PermissionsStore.ADMIN });
        if (!hasPermission) {
            return interaction.reply({ content: "`❌`・Você não tem permissão para usar este comando.", flags: 64 });
        }

        const coupon = await databases.coupons.findOne({ _id: couponid, storeId });
        if (!coupon) return await interaction.reply({ content: "`❌`・Cupom não encontrado", flags: 64 });

        if (option === "code-show-modal"){
            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:code-submit-modal`,
                title: "Editando codigo",
                inputs: [
                    { label: "Codigo do cupom", placeholder: "Digite o codigo do cupom", required: true, style: TextInputStyle.Short, customId: "code", value: coupon.code },
                ]
            })

            return modal.show(interaction as any);   
        }

        if (option === "code-submit-modal" && interaction.isModalSubmit()){
            const code = interaction.fields.getTextInputValue("code");
            if (!code) return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });

            await databases.coupons.findByIdAndUpdate(couponid, { code });
            await client.invokeInteraction(`edit-coupons:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Codigo do cupom editado com sucesso", flags: 64 });
        }

        if (option === "discount-show-modal"){
            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:discount-submit-modal`,
                title: "Editando Desconto",
                inputs: [
                    { label: "Desconto do cupom", placeholder: "Digite o desconto do cupom", required: true, style: TextInputStyle.Short, customId: "discount", value: `${coupon.discount}` },
                ]
            })

            return modal.show(interaction as any);  
        }

        if (option === "discount-submit-modal" && interaction.isModalSubmit()){
            const discount = interaction.fields.getTextInputValue("discount");
            if (!discount) return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });

            const parsedDiscount = parseFloat(discount);
            if (isNaN(parsedDiscount)) return await interaction.reply({ content: "`❌`・O desconto precisa ser um número válido.", flags: 64 });

            await databases.coupons.findByIdAndUpdate(couponid, { discount: parsedDiscount });
            await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Desconto do cupom editado com sucesso", flags: 64 });
        }

        if (option === "usage-limit-show-modal"){
            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:usage-limit-submit-modal`,
                title: "Editando limite de uso",
                inputs: [
                    { label: "Limite de usos", placeholder: "Digite o limite de usos", required: true, style: TextInputStyle.Short, customId: "usage-limit", value: `${coupon.remainingUses}` },
                ]
            })

            return modal.show(interaction as any);  
        }

        if (option === "usage-limit-submit-modal" && interaction.isModalSubmit()){
            const usagelimit = interaction.fields.getTextInputValue("usage-limit");
            if (!usagelimit) return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });

            const parsedUsagelimit = parseFloat(usagelimit);
            if (isNaN(parsedUsagelimit)) return await interaction.reply({ content: "`❌`・O limite de uso precisa ser um número válido.", flags: 64 });

            await databases.coupons.findByIdAndUpdate(couponid, { remainingUses: parsedUsagelimit });
            await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Limite de uso editado com sucesso", flags: 64 });
        }

        if (option === "expiration-date-show-modal"){
            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:expiration-date-submit-modal`,
                title: "Editando Data de Expiração",
                inputs: [
                    { label: "Data de Expiração", placeholder: "Digite a data de expiração", required: true, style: TextInputStyle.Short, customId: "expiration-date", value: `${coupon.expiresAt.toLocaleDateString()}` },
                ]
            })

            return modal.show(interaction as any);  
        }

        if (option === "expiration-date-submit-modal" && interaction.isModalSubmit()) {
            const expirationDateString = interaction.fields.getTextInputValue("expiration-date");
            if (!expirationDateString) return await interaction.reply({ content: "`❌`・Por favor, preencha todos os campos", flags: 64 });
            
            if (!isValidExpirationDate(expirationDateString)) return await interaction.reply({ content: "`❌`・A data de expiração deve ser válida e não pode estar no passado.", flags: 64 });
        
            const [day, month, year] = expirationDateString.split('/').map(Number);
            const expirationDate = new Date(year, month - 1, day);
        
            await databases.coupons.findByIdAndUpdate(couponid, { expiresAt: expirationDate });
            await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Data de Expiração editada com sucesso", flags: 64 });
        }

        if(option === "roles-select-menu") {
            const components = [
                CreateRow([
                    new CreateSelect().RoleSelectMenuBuilder({
                        customId: `edit-coupon-db:${storeId}:${couponid}:roles-submit-select-menu`,
                        placeholder: "Escolha os cargos que poderão utilizar este cupom",     
                        maxValue: 1,
                    })
                ]),
                CreateRow([
                    CreateButton({ label: "Remover todos os cargos", style: 4, customId: `edit-coupon-db:${storeId}:${couponid}:delete-roles-show-confirm-modal`, emoji: emojis.trash}),
                    CreateButton({ label: "Voltar", style: 2, customId: `edit-coupons:${storeId}:${couponid}`, emoji: emojis.back})
                ])
            ]

            await (interaction as any).update({ ...V2Reply("`⭐`・Escolha os cargos que poderão utilizar este cupom", components), files: [] })
        }

        if (option === "roles-submit-select-menu" && interaction.isRoleSelectMenu()) {
            const choiceRole = interaction.values[0];
        
            const roleValid = await interaction.guild?.roles.fetch(choiceRole);
            if (!roleValid) return await interaction.reply({ content: "`❌`・O cargo deve ser válido.", flags: 64 });
        
            const coupon = await databases.coupons.findOne({ _id: couponid, storeId });
            if (!coupon) return await interaction.reply({ content: "`❌`・Cupom não encontrado.", flags: 64 });
        
            const currentRoles = coupon.roles || [];
            if (currentRoles.includes(choiceRole)) {
                const updatedRoles = currentRoles.filter(role => role !== choiceRole);
                
                await databases.coupons.findByIdAndUpdate(couponid, { roles: updatedRoles });
                await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
                return await interaction.followUp({ content: "`✅`・Cargo removido com sucesso", flags: 64 });
            }
        
            const updatedRoles = [...new Set([...currentRoles, choiceRole])];
            
            await databases.coupons.findByIdAndUpdate(couponid, { roles: updatedRoles });
            await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Cargo adicionado com sucesso", flags: 64 });
        }

        if (option === "delete-roles-show-confirm-modal"){
            const coupon = await databases.coupons.findById(couponid);
            if (!coupon || !coupon.roles || coupon.roles.length === 0) return await interaction.reply({ content: "`❌`・Nenhum cargo vinculado a este cupom.", flags: 64 });

            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:delete-roles-submit-modal`,
                title: "Removendo cargos",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirm" },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "delete-roles-submit-modal" && interaction.isModalSubmit()) {
            const confirm = interaction.fields.getTextInputValue("confirm")
            if (confirm !== "sim") return await interaction.reply({ content: "`❌`・Confirmação inválida", flags: 64 });

            await databases.coupons.findByIdAndUpdate(couponid, { roles: [] });
            await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Todos os cargos foram removidos com sucesso.", flags: 64 });
        }

        if (option === "products") {
            const products = await databases.products.find({ storeId });
            const productsIds = coupon.products || [];
            let selectOptions: any = [];

            if (productsIds.includes("all")){
                selectOptions = [
                    { label: "Todos os produtos", value: "all", description: "Se deseja escolher os produtos, clique aqui!", emoji: "🟢" }
                ]
            }else{
                selectOptions = products.map(product => ({
                    label: `${product.name}`,
                    value: product.id,
                    description: `${productsIds.includes(product.id) ? "Clique para remover do cupom" : "Clique para adicionar esse produto ao cupum"}`,
                    emoji: productsIds.includes("all") ? "🟢" : productsIds.includes(product.id) ? "🟢" : "🔴"
                }));
                
                selectOptions.unshift({ label: "Todos os produtos", value: "all", description: "Clique para adicionar todos os produtos ao cupom", emoji: "🔴" });
            }

            const components = [
                CreateRow([
                    new CreateSelect().StringSelectMenuBuilder({
                        customId: `edit-coupon-db:${storeId}:${couponid}:products-submit-select-menu`,
                        placeholder: "Escolha um produto para vincular ao cupom",     
                        options: selectOptions,
                        maxValue: 1,
                    })
                ]),
                CreateRow([
                    CreateButton({ label: "Remover Todos os Produtos", style: 4, customId: `edit-coupon-db:${storeId}:${couponid}:delete-products-show-confirm-modal`, emoji: emojis.trash }),
                    CreateButton({ label: "Atualizar painel", style: 2, customId: `edit-coupon-db:${storeId}:${couponid}:products`, emoji: emojis.reload }),
                    CreateButton({ label: "Voltar", style: 2, customId: `edit-coupons:${storeId}:${couponid}`, emoji: emojis.back })
                ])
            ];
    
            await (interaction as any).update({ ...V2Reply("`⭐`・Escolha os produtos que serão aplicáveis ao cupom", components), files: [] });
        }
        
        if (option === "products-submit-select-menu" && interaction.isStringSelectMenu()) {
            const choiceProduct = interaction.values[0];
            await client.invokeInteraction(`edit-coupon-db:${storeId}:${couponid}:toggle-product:${choiceProduct}`, interaction);
            return
        }

        if (option === "toggle-product") {
            const productId = customParam;
            let currentProducts = coupon.products || [];

            if (currentProducts.includes(productId)){
                currentProducts = currentProducts.filter(product => product !== productId);
            }else{
                if (productId === "all"){
                    currentProducts = ["all"];
                }else{
                    currentProducts.push(productId);
                }
            }


            await databases.coupons.findByIdAndUpdate(couponid, { products: currentProducts });
            await client.invokeInteraction(`edit-coupon-db:${storeId}:${couponid}:products`, interaction);
        }

        if (option === "delete-products-show-confirm-modal"){
            const coupon = await databases.coupons.findById(couponid);
            if (!coupon?.products || coupon?.products.length === 0) return await interaction.reply({ content: "`❌`・Nenhum produto vinculado a este cupom", flags: 64 });

            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:delete-products-submit-modal`,
                title: "Removendo produtos",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirm" },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "delete-products-submit-modal" && interaction.isModalSubmit()) {
            const confirm = interaction.fields.getTextInputValue("confirm")
            if (confirm !== "sim") return await interaction.reply({ content: "`❌`・Confirmação inválida", flags: 64 });

            await databases.coupons.findByIdAndUpdate(couponid, { products: [] });
            await client.invokeInteraction(`edit-coupons:${storeId}:${couponid}`, interaction);
            return await interaction.followUp({ content: "`✅`・Todos os produtos foram removidos com sucesso.", flags: 64 });
        }

        if (option === "delete-show-confirm-modal"){
            const modal = CreateModal({
                customId: `edit-coupon-db:${storeId}:${couponid}:delete-submit-modal`,
                title: "Deletando cupom",
                inputs: [
                    { label: "Você tem certeza?", placeholder: "Digite 'sim' para confirmar", required: true, style: TextInputStyle.Short, customId: "confirm" },
                ]
            })

            return modal.show(interaction as any);
        }

        if (option === "delete-submit-modal" && interaction.isModalSubmit()){
            const confirm = interaction.fields.getTextInputValue("confirm");
            if (confirm !== "sim") return await interaction.reply({ content: "`❌`・Confirmação inválida", flags: 64 });

            await databases.coupons.findByIdAndDelete(couponid);
            await client.invokeInteraction(`config-coupons:${storeId}`, interaction);
            return await interaction.followUp({ content: "`✅`・Cupom deletado com sucesso", flags: 64 });
        }
    }
})

const isValidExpirationDate = (dateString: string): boolean => {
    const [day, month, year] = dateString.split('/').map(Number);
    const expirationDate = new Date(year, month - 1, day);
    const currentDate = new Date();

    return expirationDate instanceof Date && !isNaN(expirationDate.getTime()) && expirationDate >= currentDate;
};
