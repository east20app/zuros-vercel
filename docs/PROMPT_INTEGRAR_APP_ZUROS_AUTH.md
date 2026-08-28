# PROMPT FINAL - INTEGRAR O APP.ZUROS.SITE AO ZUROS AUTH

Trabalhe no projeto real do app.zuros.site. Preserve bancos separados: o ZUROS APP mantém compras, entregas e apenas um espelho operacional da licença; auth.zuros.site é a fonte oficial da conta e da licença.

## Produtos e entrega

- bot: depois do PIX, exigir Bot Token e entregar somente o bot hospedado.
- auth: depois do PIX, não pedir Bot Token, release nem hospedagem; provisionar somente a licença.
- complete: depois do PIX, entregar o bot hospedado e provisionar a licença na mesma compra.
- Enviar plano basic, cloud ou pro, limites de servidores e usuários verificados, recursos, duração e vitalício.

## Segurança e ambiente

Configure ZUROS_AUTH_SERVICE_URL=https://auth.zuros.site e a mesma chave forte PLATFORM_SERVICE_KEY nos dois projetos Vercel. A chave deve existir somente no backend. Nunca enviá-la ao navegador, incluí-la em logs ou salvá-la junto de tokens Discord.

Todas as chamadas usam o header x-platform-service-key. Provisionamento e renovação também usam idempotency-key estável, baseado no ID real da compra ou operação.

## Provisionamento

Chame POST /internal/platform/licenses/provision com idempotency-key purchase:<purchaseId> e corpo:

    {
      "ownerDiscordId": "discord-id-do-comprador",
      "purchaseId": "id-da-compra",
      "plan": "basic",
      "durationDays": 30,
      "lifetime": false,
      "limits": { "servers": 1, "verifiedUsers": 1000 },
      "features": ["logs", "recovery"]
    }

A resposta contém licenseId, accountId, status, plan, dashboardUrl, expiresAt, lifetime, limits e features. Nunca dependa do _id do Mongo.

Para renovar, chame POST /internal/platform/licenses/<licenseId>/renew com idempotency-key renew:<licenseId>:<operationId> e corpo { "durationDays": 30 }.

Também existem GET /<licenseId>, POST /<licenseId>/suspend com reason e POST /<licenseId>/reactivate.

## Fluxo obrigatório

1. Confirmar o PIX exclusivamente no backend.
2. Travar a compra como processing de forma atômica.
3. Para auth, provisionar e fechar a compra somente depois do sucesso.
4. Para complete, entregar bot e licença. Se uma etapa falhar, manter estado recuperável e reutilizar a mesma chave idempotente.
5. Salvar no APP apenas IDs externos, status, plano, validade, limites e recursos.
6. Mostrar dashboardUrl para o cliente concluir no Auth o onboarding seguro de Client ID, Client Secret, Bot Token e servidor.
7. Não criar OAuth/Auth do cliente durante a compra e não compartilhar MongoDB.

## Critérios de aceite

Teste Auth sem token, Bot exigindo token, Completo com as duas entregas, repetição concorrente da compra, vitalício, renovação idempotente, nova tentativa após falha e ausência da chave privada nos bundles do navegador. Preserve todos os recursos atuais da loja e não registre credenciais.
