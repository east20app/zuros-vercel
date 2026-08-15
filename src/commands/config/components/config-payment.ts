import databases from "@root/src/databases";

import { CreateButton, CreateModal, CreateRow, CreateSelect, InteractionHandler } from "fast-discord-js";
import { emojis, V2Reply } from "@root/src/functions";
import efiWrapper from "@root/src/functions/efi_wrapper";
import promisseWrapper from "@root/src/functions/promisse_wrapper";

const keyTypeDict = {
    "email": "email",
    "cpf": "cpf",
    "cnpj": "cnpj",
    "telefone": "phone",
    "chave aleatoria": "random",
}

new InteractionHandler({
    customId: "config-payment",

    run: async (client, interaction) => {

        if (!interaction.deferred && !interaction.replied) {
            await (interaction as any).deferUpdate().catch(() => {});
        }

        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const efiSettings = settingsDB?.efi_credentials || {};
        const payment_gateway = settingsDB?.payment_gateway;

        let contents = [
            "# Configuração de pagamento",
            "- Configure abaixo os gateways de pagamento que deseja utilizar",
            `> Gateway de pagamento: \`${payment_gateway === "efi" ? "Banco (efi)" : payment_gateway === "promisse" ? "PromissePay" : "Pagamento manual"}\`\n`
        ]


        const errors = [];

        if (payment_gateway === "efi"){
            if (!efiSettings?.client_id){
                errors.push(`\`⚠️\`・Client ID do **banco (efi)** não configurado!`);
            }
    
            if (!efiSettings?.client_secret){
                errors.push(`\`⚠️\`・Client Secret do **banco (efi)** não configurado!`);
            }
    
            if (!efiSettings?.cert || !efiSettings?.cert?.length){
                errors.push(`\`⚠️\`・Certificado do **banco (efi)** não configurado! (use o comando /enviarcertificado)`);
            }
    
            if (!efiSettings?.pix_key){
                errors.push(`\`⚠️\`・Chave Pix do **banco (efi)** não configurada!`);
            }
            
            if (!errors.length){
                const paymentInstance = await efiWrapper.updateCredentials(interaction.user.id).catch(() => null);
                if (paymentInstance?.isValid){
                    contents.push("`✅`・Configuração do **banco (efi)** está funcionando corretamente!\nㅤ");
                }else{
                    contents.push("`❌`・Configuração do **banco (efi)** não está funcionando corretamente! Verifique as credenciais e o certificado.\nㅤ");
                }
            }
        }

        if (payment_gateway === "manual"){
            const manualPaymentSettings = settingsDB?.manual_payment_credentials || {};
            if (!manualPaymentSettings?.pix_key){
                errors.push("`⚠️`・Chave Pix do **pagamento manual** não configurada!");
            }

            if (!manualPaymentSettings?.key_type){
                errors.push("`⚠️`・Tipo de chave do **pagamento manual** não configurado!");
            }
        }

        if (payment_gateway === "promisse"){
            const promisseSettings = settingsDB?.promissepay_credentials || {};
            if (!promisseSettings?.api_key){
                errors.push("`⚠️`・Chave de API do **PromissePay** não configurada!");
            }

            if (!errors.length){
                const promisseInstance = await promisseWrapper.updateCredentials(interaction.user.id).catch(() => null);
                if (promisseInstance?.isValid){
                    contents.push("`✅`・Configuração do **PromissePay** está funcionando corretamente!\nㅤ");
                }else{
                    contents.push("`❌`・Configuração do **PromissePay** não está funcionando corretamente! Verifique a chave de API.\nㅤ");
                }
            }
        }

        contents = contents.concat(errors);
        if (errors.length){
            contents.push("\nㅤ");
        }

        const components = [
            CreateRow([
                CreateButton({ label: "EFI Bank", style: 1, customId: "config-payment-efibank:show-modal", emoji: emojis.bank, disabled: payment_gateway !== "efi" }),
                CreateButton({ label: "Pagamento manual", style: 1, customId: "config-manual-payment:show-modal", emoji: emojis.bank, disabled: payment_gateway !== "manual" }),
                CreateButton({ label: "PromissePay", style: 1, customId: "config-promissepay:show-modal", emoji: emojis.bank, disabled: payment_gateway !== "promisse" }),
            ]),
            CreateRow([
                CreateButton({ label: `Alterar gateway de pagamento`, style: 1, customId: "config-select-payment-gateway:show-select", emoji: emojis.config }),
                CreateButton({ label: "Atualizar painel", style: 2, customId: "config-payment", emoji: emojis.reload}),
                CreateButton({ label: "Voltar para o inicio", style: 2, customId: "config", emoji: emojis.back }),
            ])
        ]

        if (interaction.deferred){
            return (interaction as any).editReply(V2Reply(contents.join("\n"), components))
        }else{
            return (interaction as any).update(V2Reply(contents.join("\n"), components))
        }

    }
})

new InteractionHandler({
    customId: "config-payment-efibank",

    run: async (client, interaction, action) => {
        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const currentValues = settingsDB?.efi_credentials || {};

        if (action === "show-modal"){
            const modal = CreateModal({
                title: "Configuração do Banco",
                customId: "config-payment-efibank:submit-modal",
                inputs: [
                    { label: "Client ID", placeholder: "Digite o client id do banco", customId: "efi-sales-config-client-id", required: false, style: 1, value: currentValues.client_id },
                    { label: "Client Secret", placeholder: "Digite o client secret do banco", customId: "efi-sales-config-client-secret", required: false, style: 1, value: currentValues.client_secret },
                    { label: "Chave Pix", placeholder: "Digite a chave pix do banco", customId: "efi-sales-config-pix-key", required: false, style: 1, value: currentValues.pix_key },
                ]
            });

            modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){

            const client_id = interaction.fields.getTextInputValue("efi-sales-config-client-id");
            const client_secret = interaction.fields.getTextInputValue("efi-sales-config-client-secret");
            const pixKey = interaction.fields.getTextInputValue("efi-sales-config-pix-key");

            await interaction.deferUpdate();
            await interaction.editReply(V2Reply("\`🔄\`・Atualizando configurações...", []));

            await databases.userSettings.updateOne( { userId_discord: interaction.user.id }, {
                $set: {
                    "efi_credentials.client_id": client_id,
                    "efi_credentials.client_secret": client_secret,
                    "efi_credentials.pix_key": pixKey,
                }
            }, { upsert: true });
            
            /**
             * Atualizar as credenciais e verifica se o banco está funcionando
             */
            const paymentInstance = await efiWrapper.updateCredentials(interaction.user.id).catch(() => null);
            await client.invokeInteraction("config-payment", interaction as any);

            if (!paymentInstance?.isValid){
                if (!currentValues.cert){
                    return await interaction.followUp({ content: "`⚠️`・As configurações foram atualizadas, porem o certificado não foi enviado. Use o comando `/enviarcertificado` para enviar o certificado.", flags: 64 });
                }else{
                    return await interaction.followUp({ content: "`⚠️`・As configurações foram atualizadas, mas o banco não está funcionando corretamente. Verifique as credenciais e o certificado se é valido.", flags: 64 });
                }
            }else{
                return await interaction.followUp({ content: "`✅`・Banco configurado com sucesso!", flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "config-manual-payment",

    run: async (client, interaction, action) => {
        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const currentValues = settingsDB?.manual_payment_credentials || {};

        if (action === "show-modal"){
            const modal = CreateModal({
                title: "Configuração de Pagamento Manual",
                customId: "config-manual-payment:submit-modal",
                inputs: [
                    { label: "Chave PIX", placeholder: "Digite a chave pix para receber o pagamento manual", customId: "pix-key", required: false, style: 1, value: currentValues.pix_key || "" },
                    { label: "Tipo de chave", placeholder: "email, cnpj, cpf, telefone, chave aleatoria", customId: "pix-key-type", required: false, style: 1, value: currentValues.key_type || "" },
                ]
            });

            modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            try {
                const pixKey = interaction.fields.getTextInputValue("pix-key");
                const keyType = interaction.fields.getTextInputValue("pix-key-type")?.toLocaleLowerCase() as keyof typeof keyTypeDict;
                
                if (keyType){
                    if (!keyTypeDict[keyType]){
                        throw new Error("Tipo de chave inválida! Use: email, cnpj, cpf, telefone ou chave aleatoria");
                    }
                }

                await interaction.deferUpdate();
                await interaction.editReply(V2Reply("\`🔄\`・Atualizando configurações...", []));
                
                await databases.userSettings.updateOne( { userId_discord: interaction.user.id }, {
                    $set: {
                        "manual_payment_credentials.pix_key": pixKey || null,
                        "manual_payment_credentials.key_type": keyType ? keyTypeDict[keyType] : null,
                    }
                }, { upsert: true });
                
                await client.invokeInteraction("config-payment", interaction as any);
                return await interaction.followUp({ content: "`✅`・Pagamento manual configurado com sucesso!", flags: 64 });

            }catch (err) {
                if (interaction.replied || interaction.deferred){
                    return await interaction.followUp({ content: "`❌`・Ocorreu um erro ao salvar as configurações!", flags: 64 });
                }else{
                    return await interaction.reply({ content: "`❌`・Ocorreu um erro ao salvar as configurações!", flags: 64 });
                }
            }
        }
    }
})

new InteractionHandler({
    customId: "config-select-payment-gateway",

    run: async (client, interaction, action, selectValue) => {
        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });

        if (action === "show-select"){

            const currentGateway = settingsDB?.payment_gateway;
           
            const components = [
                CreateRow([
                    new CreateSelect().StringSelectMenuBuilder({
                        customId: "config-select-payment-gateway:submit-select",
                        placeholder: "Selecione o gateway de pagamento",
                        options: [
                            { label: "Banco (efi)", value: "efi", description: "Utilize o banco efi para processar os pagamentos automaticamente", emoji: "🏦", default: currentGateway === "efi"},
                            { label: "Pagamento manual", value: "manual", description: "Utilize o pagamento manual para receber pagamentos por fora da plataforma", emoji: "💵", default: currentGateway === "manual"},
                            { label: "PromissePay", value: "promisse", description: "Utilize a PromissePay para processar pagamentos PIX automaticamente", emoji: "💳", default: currentGateway === "promisse"}
                        ],
                        getValueInLastParam: true,
                    })
                ]),
                CreateRow([
                    CreateButton({ label: "Voltar", style: 2, customId: "config-payment", emoji: emojis.back }),
                ])
            ]

            return (interaction as any).update({ ...V2Reply("\`🔄\`・Selecione o gateway de pagamento padrão:", components), flags: 64 });
        }

        if (action === "submit-select"){
            try{
                if (settingsDB?.payment_gateway === selectValue){
                    return interaction.reply({ content: "`⚠️`・Este gateway já está selecionado como padrão!", flags: 64 });
                }

                await databases.userSettings.updateOne( { userId_discord: interaction.user.id }, {
                    $set: {
                        payment_gateway: selectValue
                    }
                }, { upsert: true, runValidators: true });

                await client.invokeInteraction("config-payment", interaction as any);
                return interaction.followUp({ content: "`✅`・Gateway de pagamento atualizado com sucesso!", flags: 64 });
            }catch{
                return interaction.reply({ content: "`❌`・Ocorreu um erro ao atualizar o gateway de pagamento!", flags: 64 });
            }
        }
    }
})

new InteractionHandler({
    customId: "config-promissepay",

    run: async (client, interaction, action) => {
        const settingsDB = await databases.userSettings.findOne({ userId_discord: interaction.user.id });
        const currentValues = settingsDB?.promissepay_credentials || {};

        if (action === "show-modal"){
            const modal = CreateModal({
                title: "Configuração do PromissePay",
                customId: "config-promissepay:submit-modal",
                inputs: [
                    { label: "API Key", placeholder: "Cole sua chave de API do PromissePay (sk_live_...)", customId: "promisse-api-key", required: false, style: 1, value: "" },
                ]
            });

            modal.show(interaction);
        }

        if (action === "submit-modal" && interaction.isModalSubmit()){
            const apiKey = interaction.fields.getTextInputValue("promisse-api-key");

            await interaction.deferUpdate();
            await interaction.editReply(V2Reply("\`🔄\`・Atualizando configurações do PromissePay...", []));

            await databases.userSettings.updateOne({ userId_discord: interaction.user.id }, {
                $set: {
                    "promissepay_credentials.api_key": apiKey || "",
                }
            }, { upsert: true });

            if (apiKey) {
                const promisseInstance = await promisseWrapper.updateCredentials(interaction.user.id).catch(() => null);
                await client.invokeInteraction("config-payment", interaction as any);

                if (!promisseInstance?.isValid){
                    return await interaction.followUp({ content: "`⚠️`・As configurações foram atualizadas, mas a chave de API do PromissePay não está funcionando corretamente. Verifique se a chave está correta.", flags: 64 });
                }else{
                    return await interaction.followUp({ content: "`✅`・PromissePay configurado com sucesso!", flags: 64 });
                }
            }else{
                promisseWrapper.clearInstance(interaction.user.id);
                await client.invokeInteraction("config-payment", interaction as any);
                return await interaction.followUp({ content: "`✅`・Configuração do PromissePay removida!", flags: 64 });
            }
        }
    }
})