# PROMPT MESTRE — BOT OFICIAL DE CLIENTES ZUROS + API PRIVADA + AUTH

Você está trabalhando no monorepo real **ZUROS**, cujo backend/painel é Next.js + TypeScript + MongoDB e cujo domínio é `https://app.zuros.site`. O repositório contém a lógica histórica do bot em `src/`, o painel em `site/`, o cliente de integração em `bridge-bot-integration/` e a integração comercial do ZUROS Auth em `src/functions/zuros-auth-client.ts`.

## Objetivo

Criar um **novo bot oficial para clientes da ZUROS**, em **Python 3.11 + discord.py 2.x**, separado dos bots que os clientes compram e hospedam.

Esse bot oficial deve oferecer no Discord, principalmente pelo comando `/app`, a mesma experiência de consulta e controle que existia no comando `/apps` de `src/commands/apps/index.ts`, incluindo as licenças e recursos do **ZUROS Auth** no mesmo painel.

O bot oficial:
- atende todos os clientes da plataforma;
- não é uma cópia do bot DROX vendido ao cliente;
- não acessa MongoDB, CamposCloud ou ZUROS Auth diretamente;
- nunca recebe a chave global do Auth;
- nunca expõe token, Client Secret ou chave;
- consome somente uma API privada criada no `app.zuros.site`;
- usa componentes Discord modernos, respostas efêmeras e português correto;
- mantém um servidor principal por aplicação;
- respeita posse, expiração, carência, planos e limites.

## Antes de programar

Leia completamente e preserve os contratos de:
- `src/commands/apps/index.ts`
- `src/integration/apps.ts`
- `src/integration/dtos.ts`
- `src/databases/schemas/applications.ts`
- `src/databases/schemas/auth-licenses.ts`
- `src/functions/hosted-bot.ts`
- `src/functions/zuros-auth-client.ts`
- `src/integration/purchases.ts`
- `src/integration/releases.ts`
- `bridge-bot-integration/zuros_integration_client.py`
- `site/app/api/bot-telemetry/route.ts`
- `site/lib/actions/apps.actions.ts`
- `site/lib/actions/auth.actions.ts`

Não duplique regras de negócio. Extraia serviços compartilhados para site, bot antigo e nova API usarem a mesma implementação.

# PARTE 1 — API PRIVADA DO BOT DE CLIENTES

Crie as rotas em `site/app/api/client-bot/v1/**/route.ts`, com runtime Node.js e conteúdo dinâmico.

## Autenticação obrigatória

Use:
- `ZUROS_CLIENT_BOT_ID`
- `ZUROS_CLIENT_BOT_SECRET`

Headers:
- `Authorization: Bearer <secret>`
- `X-Zuros-Bot-Id`
- `X-Zuros-Timestamp`
- `X-Zuros-Nonce`
- `X-Zuros-Signature`
- `X-Request-ID`

Assine com `HMAC-SHA256(secret, METHOD + "\n" + PATH_WITH_QUERY + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + SHA256_RAW_BODY)`.

Exija comparação constante, janela de 5 minutos, nonce único com TTL, limite de corpo, rate limit, logs sanitizados, requestId, falha fechada e rotação de segredo. Nunca use o token Discord como credencial da API.

Envelope de sucesso:
```json
{"success":true,"data":{},"requestId":"uuid"}
```

Envelope de erro:
```json
{"success":false,"error":{"code":"APP_NOT_FOUND","message":"Aplicação não encontrada."},"requestId":"uuid"}
```

## Autorização

Toda rota recebe o Discord ID autenticado pelo bot e valida a posse no backend. Nunca confie apenas em IDs enviados pelo componente. Consulte aplicações por `{_id: applicationId, ownerId: discordUserId}` e licenças por `{licenseId, ownerDiscordId: discordUserId}`. Retorne 404 para recurso inexistente ou alheio.

## DTO seguro

Nunca retorne token, chave CamposCloud, gateway, variável de ambiente ou documento Mongo completo. Retorne:
```ts
{
 id:string; publicId:string; name:string; botId:string;
 product:{id:string;name:string};
 status:"active"|"grace_period"|"suspended"|"provisioning"|"error";
 runtime:{online:boolean;memoryUsedBytes?:number;memoryLimitBytes?:number;uptimeSeconds?:number};
 subscription:{lifetime:boolean;expiresAt?:string;daysRemaining?:number};
 release:{installed?:string;available?:string;updatePending:boolean;updateError:boolean};
 primaryGuildId?:string; inviteUrl?:string; dashboardUrl:string;
}
```

## Rotas obrigatórias

### Plataforma
- `GET /api/client-bot/v1/health`
- `GET /users/:discordUserId/summary`

### Aplicações
- `GET /users/:discordUserId/apps`
- `GET /users/:discordUserId/apps/:applicationId`
- `GET /users/:discordUserId/apps/:applicationId/status`
- `POST /users/:discordUserId/apps/:applicationId/actions/start`
- `POST /users/:discordUserId/apps/:applicationId/actions/restart`
- `POST /users/:discordUserId/apps/:applicationId/actions/stop`
- `POST /users/:discordUserId/apps/:applicationId/actions/refresh`
- `GET /users/:discordUserId/apps/:applicationId/invite`
- `GET /users/:discordUserId/apps/:applicationId/renewal`
- `PATCH /users/:discordUserId/apps/:applicationId/name`
- `POST /users/:discordUserId/apps/:applicationId/token`
- `PUT /users/:discordUserId/apps/:applicationId/primary-guild`
- `GET /users/:discordUserId/apps/:applicationId/releases`
- `POST /users/:discordUserId/apps/:applicationId/releases/update`

Renovação deve retornar checkout seguro e idempotente. Token deve ser validado no Discord, nunca devolvido, e reimplantado pelo serviço compartilhado preservando arquivos protegidos. Servidor principal deve ser único. Atualizações devem retornar queued/running/completed/failed. Ações devem usar lock por aplicação e reutilizar a camada usada pelo site, sem duplicar chamadas CamposCloud.

### ZUROS Auth
- `GET /users/:discordUserId/auth/licenses`
- `GET /users/:discordUserId/auth/licenses/:licenseId`
- `GET /users/:discordUserId/auth/licenses/:licenseId/stats?days=7`
- `GET|PUT /users/:discordUserId/auth/licenses/:licenseId/message`
- `GET /users/:discordUserId/auth/licenses/:licenseId/destinations`
- `GET /users/:discordUserId/auth/licenses/:licenseId/verified-users`
- `GET|POST /users/:discordUserId/auth/licenses/:licenseId/recovery`
- `POST /users/:discordUserId/auth/licenses/:licenseId/recovery/:taskId/cancel`
- `GET|POST /users/:discordUserId/auth/licenses/:licenseId/gifts`
- `POST /users/:discordUserId/auth/licenses/:licenseId/gifts/:giftId/redeem`
- `DELETE /users/:discordUserId/auth/licenses/:licenseId/gifts/:giftId`
- `GET /users/:discordUserId/auth/licenses/:licenseId/team`
- `POST /users/:discordUserId/auth/licenses/:licenseId/team/invite`
- `PATCH|DELETE /users/:discordUserId/auth/licenses/:licenseId/team/:memberId`
- `PATCH /users/:discordUserId/auth/licenses/:licenseId/settings`
- `PATCH /users/:discordUserId/auth/licenses/:licenseId/definitions`
- `POST /users/:discordUserId/auth/licenses/:licenseId/credential/rotate`
- `GET /users/:discordUserId/auth/licenses/:licenseId/logs`
- `GET /users/:discordUserId/auth/licenses/:licenseId/tasks`
- `POST /users/:discordUserId/auth/licenses/:licenseId/auth-link`

Essas rotas validam licença local e posse, usam somente `zuros-auth-client.ts`, mantêm `PLATFORM_SERVICE_KEY` no backend, respeitam RBAC/capabilities, paginação e idempotência. Nunca retornam OAuth tokens, Bot Token ou Client Secret. Se o Auth cair, retornam `503 AUTH_SERVICE_UNAVAILABLE` sem derrubar aplicações.

### Notificações
- `GET /users/:discordUserId/notifications?cursor=&limit=20`
- `POST /users/:discordUserId/notifications/:notificationId/read`
- `GET /users/:discordUserId/events` via SSE autenticado com Last-Event-ID.

Eventos: app.started/stopped/restarted, app.update.completed/failed, subscription.expiring, auth.user.verified/blocked, auth.recovery.progress/completed, ticket.opened, cart.opened e payment.approved. DM somente com opt-in. Não alterar nem reutilizar o Disparador de DMs do DROX.

# PARTE 2 — BOT DISCORD DE CLIENTES

Crie `services/zuros-client-bot/` em Python 3.11, discord.py 2.x, aiohttp, pydantic-settings, pytest, Ruff e Black. O bot não usa MongoDB.

Estrutura:
```text
services/zuros-client-bot/
  bot.py
  requirements.txt
  .env.example
  README.md
  zuros_client/
    config.py
    api.py
    errors.py
    security.py
    cache.py
    views/
      app_list.py
      app_detail.py
      app_settings.py
      auth_home.py
      auth_users.py
      auth_recovery.py
      auth_gifts.py
      auth_team.py
      pagination.py
    cogs/
      app.py
      notifications.py
    services/
      formatters.py
      interaction_guard.py
  tests/
```

Env:
```env
DISCORD_TOKEN=
ZUROS_API_BASE_URL=https://app.zuros.site
ZUROS_CLIENT_BOT_ID=
ZUROS_CLIENT_BOT_SECRET=
ZUROS_SUPPORT_URL=
LOG_LEVEL=INFO
HTTP_TIMEOUT_SECONDS=20
```

## /app

Registre `/app` global. Não exija storeId.

Fluxo:
1. defer efêmero;
2. consulta summary e apps;
3. sem produtos: “Você ainda não possui produtos ZUROS”, botões Conhecer planos e Ajuda;
4. um recurso: abre direto;
5. vários: select paginado;
6. jamais mostra recurso alheio.

Painel: nome, produto, online/offline, memória, uptime, expiração/lifetime, versão instalada/disponível, atualização e servidor principal.

Botões compactos: Iniciar, Reiniciar, Parar, Atualizar, Renovar, Configurações, Adicionar ao servidor, ZUROS Auth quando incluso e Abrir painel web.

Desabilite botões conforme estado. Renovar não aparece em lifetime. Tudo de conta é efêmero.

Configurações: Alterar nome, Atualizar token, Selecionar servidor principal, Atualizar versão e Voltar. O modal de token envia direto à API, não ecoa nem mantém o valor.

## Auth dentro de /app

Fica no mesmo bot e fluxo, visualmente separado do bot hospedado. Opções: Visão geral, Mensagem, Destinos, Usuários verificados, Recovery, Gifts, Equipe, Configurações, Definições, Logs, Tarefas e Gerar link individual.

Links OAuth sempre individuais e curtos. Paginação de 10 usuários. Confirmação para destrutivos. Recovery mostra progresso/cancelamento. Credencial rotacionada aparece uma única vez. Respeite OWNER/ADMIN/SUPPORT/VIEWER e capabilities. Não misture funções do DROX nessa área.

## Segurança das interações

Respostas efêmeras; custom_id sem segredo; callback vinculado ao dono da View; timeout de 10 minutos; botões desabilitados ao expirar; prevenção de clique duplo; Retry-After em 429; mensagens úteis em 503 com requestId; convite com permissões mínimas, nunca permissions=8 por padrão.

## Cliente HTTP

Implemente ZurosClientApi com ClientSession única, HMAC, nonce seguro, timeout, retry somente idempotente, backoff com jitter, circuit breaker, paginação, fechamento limpo e logs sem segredo. Erros tipados: Unauthorized, Forbidden, NotFound, Conflict, RateLimited e ServiceUnavailable.

## SSE

Reconexão com Last-Event-ID, backoff 5–60 segundos, jitter, deduplicação, heartbeat, opt-in de DM e fallback de polling para eventos críticos.

# COMPATIBILIDADE

- /apps antigo continua durante migração.
- /app não depende do processo antigo.
- Site e bot usam os mesmos DTOs/estados.
- Mutações idempotentes.
- Não alterar arquivos protegidos nem Disparador de DMs.
- Não mostrar CamposCloud ao cliente.
- Corrigir qualquer texto Ã§/Ã£/â.
- Usar marca ZUROS e termos aplicação, bot, plano e servidor principal.

# TESTES

API: HMAC, timestamp, replay, corpo, rate limit, app/licença alheios, DTO sem token, ações idempotentes, lock, Auth indisponível, paginação, recovery/gifts, SSE e requestId.

Bot: /app vazio/único/múltiplo, online/offline, carência, lifetime, renovação, nome/token/servidor, clique alheio, Auth, paginação, link individual, recovery, gifts, RBAC, erros 401/403/404/409/429/503, SSE e shutdown.

Execute:
```bash
npm ci
npm --prefix site ci
npm run check:secrets
npm run typecheck
npm run lint
npm --prefix site test
npm --prefix site run build:next
python -m compileall -q services/zuros-client-bot
ruff check services/zuros-client-bot
black --check services/zuros-client-bot
pytest -q services/zuros-client-bot/tests
npm audit --omit=dev
npm --prefix site audit --omit=dev
```

# ACEITE

Só conclua quando /app controlar aplicações com posse validada; renovação funcionar; token nunca vazar; Auth funcionar dentro do mesmo painel; RBAC ser respeitado; API impedir replay; SSE reconectar sem duplicar; desktop/celular funcionarem; todos os testes passarem; protegidos permanecerem intactos; documentação e exemplos sem segredos existirem.

Entregue lista de arquivos, matriz de rotas, matriz botão→endpoint, decisões de segurança, resultados dos testes, limitações reais e instruções separadas de deploy da API e do bot. Não use mocks em produção e não esconda erros.
