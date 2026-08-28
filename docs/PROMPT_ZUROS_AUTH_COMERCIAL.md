# PROMPT FINAL — INTEGRAR O ZUROS AUTH À LOJA ZUROS

Você está trabalhando no projeto real **ZUROS Auth**, em Python/FastAPI + MongoDB, publicado em `https://auth.zuros.site`. Integre-o comercialmente ao `https://app.zuros.site` sem copiar telas do concorrente e sem misturar os bancos dos dois produtos.

## Objetivo

O ZUROS APP vende três modalidades:

1. **Bot**: entrega somente o bot hospedado e exige token Discord após o PIX.
2. **Auth**: entrega somente uma licença do ZUROS Auth; não exige token, release ou hospedagem.
3. **Completo**: entrega bot hospedado + licença ZUROS Auth na mesma compra.

Planos do Auth: `basic` (Auth), `cloud` (Bot + Auth) e `pro` (Completo). Cada produto informa limite de servidores, limite de usuários verificados e lista de recursos.

## Contrato privado obrigatório

Mantenha uma chave forte e exclusiva em `PLATFORM_SERVICE_KEY`. Todas as rotas abaixo exigem `x-platform-service-key`. Provisionamento e renovação também exigem `idempotency-key`. Nunca aceite chave vazia, nunca exponha a chave ao navegador e nunca registre credenciais/tokens.

Prefixo: `/internal/platform/licenses`

- `POST /provision`: recebe `ownerDiscordId`, `purchaseId`, `plan`, `durationDays`, `lifetime`, `limits.servers`, `limits.verifiedUsers`, `features`. Cria ou atualiza a conta pelo Discord ID e retorna `licenseId`, `accountId`, `status`, `plan`, `dashboardUrl`, `expiresAt`.
- `GET /{license_id}`: consulta a licença.
- `POST /{license_id}/renew`: renova sem duplicar a operação.
- `POST /{license_id}/suspend`: suspende e rebaixa a conta com auditoria.
- `POST /{license_id}/reactivate`: reativa enquanto a licença for válida.

## Regras obrigatórias

- Índices únicos em `platform_licenses.id` e `platform_licenses.idempotency_key`.
- Índice em `(owner_discord_id, status)` e em `platform_license_operations.idempotency_key`.
- Uma repetição do mesmo `idempotency-key` deve devolver a mesma licença.
- Não criar Auth/OAuth do cliente na compra: criar a conta/licença. O cliente conclui Client ID, Client Secret, Bot Token e guild no onboarding seguro do Auth.
- Vincular a licença à conta Discord no primeiro login e manter ownership server-side.
- Expiração deve revogar recursos pagos sem apagar configurações do cliente.
- Nunca retornar `_id` do Mongo, segredo, access token, refresh token ou bot token.
- Adicionar auditoria para provisionar, renovar, suspender e reativar.
- Testar chave ausente/incorreta, idempotência concorrente, compra vitalícia, renovação, expiração e ownership.

## Arquivos já preparados nesta entrega

- `app/api/routes_platform.py`: rotas privadas de licença.
- `app/config.py`: `platform_service_key` obrigatório via ambiente.
- `app/db/mongo.py`: índices das licenças/operações.
- `app/main.py`: registro do router privado.
- `.env.example`: documentação de `PLATFORM_SERVICE_KEY`.

Revise esses arquivos, normalize respostas e nomes, adicione testes pytest e mantenha compatibilidade com o painel atual. Não remova OAuth, recovery, gifts, RBAC, filas ou recursos existentes. Ao terminar, rode `python -m compileall -q app`, testes e faça deploy somente após configurar a mesma chave privada no ZUROS APP e no ZUROS Auth.