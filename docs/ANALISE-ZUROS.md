# ZUROS Apps — Análise Completa, Integração DROX e Personalização

> Documento de referência gerado após auditoria arquivo por arquivo do projeto
> **ZUROS BOT + ZUROS APP** (monorepo TypeScript: bot Discord em `src/` + painel
> Next.js 14 em `site/`). Sem valores de segredo — apenas nomes de variáveis de
> ambiente e caminhos.

---

## 1. Visão geral da arquitetura

A plataforma roda **em um único processo Node.js** que:

1. Sobe o **painel web Next.js 14** (`site/`) via `next` + servidor HTTP próprio;
2. Sobe o **bot Discord gerente** (`src/`) em um **Worker thread isolado**
   (`src/bot-worker.ts`) com auto-healing por heartbeat;
3. Conecta ao **MongoDB** (`src/databases/connection.ts`) com dois bancos
   conceituais: o banco principal do painel e o banco **`drox_bots`**
   (compartilhado com o DROX Bot, acessado pelo painel por
   `DROX_BOTS_MONGO_URI`).

```
┌─────────────────────────────────────────────────────────┐
│ Processo principal (src/index.ts)                        │
│  ├─ HTTP server → Next.js request handler (site/)        │
│  ├─ Mongoose (pool 10) → MongoDB principal (painel)      │
│  └─ Worker thread (src/bot-worker.ts) → bot Discord      │
│       └─ Mongoose (pool 5) → MongoDB (mesmas collections)│
└─────────────────────────────────────────────────────────┘
        │ reads/writes                                        │
        ▼                                                      ▼
   zuros (aplicações, lojas, produtos…)              drox_bots (docs de
                                                    configuração do DROX Bot:
                                                    loja_products, proteção, etc.)
```

### Stack

- **Backend bot/servidor:** Node.js + TypeScript + Discord.js
- **Painel:** Next.js 14 (App Router) + React 18 + Tailwind CSS
- **Banco:** MongoDB + Mongoose
- **Auth:** NextAuth v4 (JWT) + Discord OAuth2
- **Pagamentos:** EFI (PIX) via `sdk-node-apis-efi`, PromissePay e manual
- **Hospedagem:** CamposCloud SDK
- **Utilitários:** zod (validação), wio.db, node-cron/loops (`asyncLoopingExec`),
  adm-zip + `ignore` (releases), Chart.js (gráficos de vendas)

---

## 2. Backend — `src/`

### 2.1 `src/index.ts` — bootstrap

- `nextApp = next({ dev, dir: site })` com `getRequestHandler()` montado em um
  `http.createServer`.
- `serveCompatibleStaticAsset()`: serve assets de `/site/next-build-visual`
  (build de produção imutável) com cache 1 ano e proteção contra path traversal.
- **Worker isolado do bot**: `startBotWorker()` cria um `Worker` para
  `src/bot-worker.ts` com limites de memória (160MB old generation), heartbeat a
  cada 15s e timeout de 45s → se o worker ficar mudo, é encerrado e reiniciado
  com **backoff exponencial** (até 30s). Falhas do bot não derrubam o painel.
- `bootstrap()` inicia worker + painel em paralelo (`Promise.allSettled`).
- `shutdown()` encerra HTTP e worker com graça.
- Tratamento global de `unhandledRejection`/`uncaughtException` → telemetria.

### 2.2 `src/config/env.ts` — ambiente

Carrega `.env.${NODE_ENV}` e `.env` (dotenv). Resolve `${MONGO_DB_URL}` em
`DROX_BOTS_MONGO_URI` quando referenciado. Valida com zod:

| Chave | Obrigatório | Uso |
|---|---|---|
| `BOT_TOKEN` | sim | token do bot gerente |
| `MONGO_DB_URL` | sim | conexão principal (painel + bot) |
| `DROX_BOTS_MONGO_URI` | sim | acesso ao banco `drox_bots` |
| `OWNER_ID` | não | dono da plataforma (admin raiz) |
| `HOST` / `PORT` | não / default 3000 | bind do servidor web |

> Obs.: o runtime **não valida** `NEXTAUTH_URL`/`NEXTAUTH_SECRET` — só o build/painel.

### 2.3 `src/databases/` — conexão e schemas

- `connection.ts`: `mongoose.connect(env.MONGO_DB_URL)` com pools separados por
  thread (10 main / 5 worker), `appName` distinto (`zuros-web` / `zuros-manager-bot`).
- `index.ts`: agrega e exporta os modelos (barrel `databases`).
- `schemas/applications.ts` — **aplicações (instâncias hospedadas do cliente)**:
  `name`, `ownerId` (discord do dono), `storeId` (ref stores), `botId`,
  `appId` (id na CamposCloud), `token`, `productId` (ref products), `expiresAt`,
  `version`, `lifetime`, `status: "grace_period"|"active"`, `updateAttempts`,
  `errorOnUpdate`, `errorOnUpdateMessage`.
- `schemas/stores.ts` — **lojas**: `name`, `ownerId_campos`, `teamId_campos`,
  `balance` (saldo de créditos), `logsAndRoles` (canais de log + cargo de cliente),
  `permissions[]` ({ userId, permissions[] }).
- `schemas/products.ts` — **produtos vendidos**: `storeId`, `name`,
  `runtimeEnvironment` (python/nodejs/java/go/rust/dotnet/deno), `runCommand`,
  `messageSettings` (canal/mensagem/button/vídeo/banner/descrição),
  `redeemSettings`, `prices` (weekly/biweekly/monthly/lifetime), `protectedFiles`,
  `memoryMB`, `currentReleaseVersion`, `lastReleaseCreatedVersion`, `releases[]`.
- `schemas/carts-buy.ts` — **carrinhos de compra**: canal, usuário, produto,
  preço/finalPrice, cupom, `automaticPayment`, `status`
  (`opened/closed/cancelled/processing/expired`), `step`
  (`select-days/select-coupons/waiting-payment/payment-confirmed`), pix (qrcode,
  copy-paste), `paymentId`, `expiresAt`, `delivered`.
- `schemas/carts-renew.ts` — **carrinhos de renovação**: igual, mas referencia
  `applicationId`, com `days`/`lifetime`.
- `schemas/coupons.ts` — cupons: `code` único, `discount`, `remainingUses`,
  `expiresAt`, `roles[]`, `products[]`.
- `schemas/extracts.ts` — **extrato financeiro**: `origin` (sales/manual),
  `action` (add/remove), `description`, `amount`, `storeId`, timestamps.
- `schemas/global-settings.ts` — `key`/`value` genérico (ex.: presences do bot).
- `schemas/user-settings.ts` — **configuração por usuário (dono de loja)**:
  `userId_discord`, `userId_campos`, `token_campos`, `efi_credentials`,
  `manual_payment_credentials`, `promissepay_credentials`, `payment_gateway`,
  `settings`.

### 2.4 `src/integration/` — casos de uso compartilhados (bot + painel)

- `apps.ts` — cria/lista/para/inicia/renomeia aplicações na CamposCloud,
  `getMetrics`, `listApplicationGuilds`, helpers de renovação e de mensagem do
  carrinho de renovação (`getCartMessageRenew`).
- `purchases.ts` — **fluxo de compra**: `startPurchase`, validação de token,
  guilds, `getPlanUsage` (memória livre), criação da aplicação, rollback em
  falha; confirmação de carrinho (`confirmCartPayment`).
- `releases.ts` — **publicação de releases**: `publishProductRelease`, validação
  de caminho seguro (`safeReleaseEntryPath`), escrita de `.zip` em
  `releases/<productId>/<version>.zip`, marcação `needToUpdateApplications`.
- `release-archive.ts` — empacotamento/hash de arquivos de release.
- `telemetry.ts` — `log`/`logError` (persistem eventos), `reportStatus`
  (estado web/bot), `getPlatformTelemetry` (usado pelo painel admin).
- `activity-log.ts` — `recordActivity`/`getActivityLog` (log de atividades por
  loja; alimenta o SSE de `/api/activity`).
- `public-dashboard.ts` — vitrine pública: `getRecentPublicSales`,
  `listStoreCatalogs`, `getUserPendingCount`.
- `certificates.ts` — validação/limite de upload de certificados.
- `dtos.ts` — tipos/contratos compartilhados entre camadas.

### 2.5 `src/functions/` — utilitários

- `hosted-bot.ts` — **deploy de bots hospedados**: valida credenciais
  (`BOT_TOKEN_PATTERN`, `BOT_ID_PATTERN`), `buildHostedBotPackageBuffer`
  (tree-shaking de arquivos descartáveis, remove `config.json`/`.env`/`token.txt`,
  injeta `config.json` + `.env` + `token.txt` com `API_URL`, `TELEMETRY_URL`,
  `VERSION`, `PERMS` etc.), `redeployWithNewToken`.
- `acl.ts` — controle de permissões por loja.
- `camposcloud-sdk.ts` — wrapper singleton do SDK CamposCloud por usuário
  (com cache de instância).
- `status-cache.ts` — **cache de status das instâncias** (`getCachedInstanceStatus`):
  TTL 20s, stale 90s (retorna valor antigo enquanto o refresh roda), com
  `invalidateInstanceStatus`/`clearInstanceStatusCache`.
- `efi_wrapper.ts` / `promisse_wrapper.ts` — gateways PIX (EFI via SDK;
  PromissePay via API key).
- `notify-wrapper.ts` — `notifyUser`/`notifyChannelLog` (DM e canais de log).
- `extracts.ts` — `changeBalance` (crédito/débito no saldo da loja + registro no extrato).
- `rate-limit.ts`, `emojis.ts`, `chart.ts`, `pages.ts`, `utils.ts`, `v2.ts`,
  `index.ts` — helpers diversos.

### 2.6 `src/cronjobs.ts` — tarefas em loop (`asyncLoopingExec`)

- **6s** — presences do bot gerente (global-settings `rich_presences`).
- **5s — pagamentos PIX**: varre carrinhos `buy` e `renew` em
  `waiting-payment`/`automaticPayment`, consulta EFI (`CONCLUIDA`) ou Promisse
  (`PAID`), credita saldo (com desconto correto de cupom), fecha carrinho,
  entrega (cargo de cliente, edição de mensagem), estende expiração ou marca
  vitalícia, notifica usuário. Limpa `renewCartsMessage` (anti memory-leak).
- **5s — expiração de carrinhos**: marca `expired`, limpa thread do Discord.
- **3s — expiração de aplicações**: `grace_period` de 4 dias (`GRACE_PERIOD_DAYS`),
  para a instância na CamposCloud, notifica; após o período, deleta na CamposCloud
  e na DB e notifica.
- **5s — atualização de bots para releases**: por loja, produtos com
  `needToUpdateApplications`, baixa o `.zip`, remove `protectedFiles`,
  sobe `uploadFile` na CamposCloud (parando/startando a app), com 3 tentativas e
  rate-limit de 3s por app; marca `errorOnUpdate` em falha.

### 2.7 `src/commands/` — comandos do bot Discord

- `apps` — gerenciamento de aplicações pelo cliente no Discord (listar, renovar,
  carrinho de renovação, mensagens).
- `config` — painel de configuração da loja via Discord (componentes: produtos,
  payment, coupons, statistics, apps-hosted, advanced-config).
- `configbot` — config do bot hospedado.
- `aprovar` — aprovação manual de pagamentos.
- `enviar-release` / `enviarcertificado` — envio de releases e certificados.

### 2.8 `src/events/` — eventos

- `buy.event.ts` — interação de compra (thread, carrinho, `getCartMessage`).
- `autocomplete.event.ts` — autocompletes (ex.: servidores, produtos).

### 2.9 Worker e cliente

- `src/bot-worker.ts` — thread do bot: sobe client Discord, envia heartbeat e
  logs ao processo principal.
- `src/bot-client.ts` — exporta o client Discord (`client`).

---

## 3. Frontend — `site/`

### 3.1 Configurações

- `package.json`: next 14.2.35, next-auth ^4.24.7, mongoose ^8.7.0, zod ^3.23.8,
  tailwind ^3.4.1, chart.js, qrcode/qrcode-pix, sdk-node-apis-efi,
  @camposcloud/sdk.
- `next.config.mjs`: `distDir` (dev/prod), rewrite `/favicon.ico`→`/icon.svg`,
  headers (X-Frame-Options DENY, cache estático).
- `tailwind.config.ts`: paleta remapeada (zinc→navy, emerald/red/blue→Discord,
  **magenta novo**), fontes **Poppins (display) + Inter (sans)**.
- `tsconfig.json`: strict; alias `@/*`→`site/*`, `@root/*`→raiz.
- `globals.css`: variáveis de tema (`--background #0a0e27`, `--surface`,
  `--accent #5865f2`, `--magenta #eb459e`, …), utilidades `zuros-*`, `glass`,
  skeletons, keyframes e animações.

### 3.2 Rotas do App Router

**Públicas**
- `/` — landing (hero + badges de vendas reais + catálogo + seções).
- `/planos` — planos (catálogo público).
- `/login` — login via Discord (LoginForm).

**Painel (`/dashboard`)**
- `layout.tsx` — `requireUser()` + `DashboardShell` (sidebar + saldo + pending).
- `page.tsx` — **lista de aplicações** com `DashboardAppCard` (status, plano,
  versão, ações rápidas Iniciar/Pausar/Reiniciar, botão Configurar DROX).
- `/[appId]/page.tsx` — **detalhes com abas**: Informações (KPIs + histórico),
  Controles (AppControls) e Configurar DROX (BotConfigHeader + BotConfigIndex).
- `/[appId]/config` + `/config/[modulo]` — editor de configuração DROX
  (módulos loja/proteção/etc.).
- `/[appId]/vendas/*` — 6 páginas: visão geral (KPIs + Chart.js), pedidos,
  produtos, carrinhos-abertos, clientes, pagamentos.
- `/invoices` — faturas/renovação pendente (RenewalAlerts + RenewPanel).
- `/store/cart/[cartId]` — checkout de compra pública (PurchasePaymentPanel).
- `/account/*` — perfil, afiliados, notificações, extrato, faturas.

**Admin (`/admin`)**
- overview com 6 stats; `/settings` (CamposToken, PaymentForm, BotIdentity);
- `/[storeId]/*` — apps, products (+releases), coupons, carts, payments, extracts,
  releases; proteção `canAccessAdmin`.

**APIs**
- `/api/auth/[...nextauth]` — NextAuth.
- `/api/webhooks/efi` e `/api/webhooks/promissepay` — confirmação de PIX
  (HMAC sha256 com `EFI_WEBHOOK_SECRET`/`PROMISSEPAY_WEBHOOK_SECRET`).
- `/api/bot-telemetry` — o DROX Bot envia telemetria/atividades.
- `/api/activity` — SSE de atividades (heartbeat 20s).
- `/api/admin/status`, `/api/admin/certificate`, `/api/products/[productId]/releases`,
  `/favicon.ico`.

### 3.3 Componentes principais (`site/components/`)

- `ui.tsx` — primitivas: Button (6 variantes), Card/DiscordCard, Badge, Stat,
  Spinner, Skeleton, PillTabs, Empty, Field, inputClass, Modal (focus trap/ESC),
  ConfirmDialog.
- `Sidebar.tsx` + `BotsNav.tsx` — **sidebar nova**: logo Z gradiente
  (blurple→magenta), abas Apps/Admin/Conta, links Dashboard/Faturas/Configurações,
  **lista "Todos os Bots" expansível com chevron** e **bot ativo em destaque**,
  seção Vendas/Configuração quando dentro de um bot, perfil + logout na base,
  **modo foco (rail estreito)** ao abrir o configurador.
- `DashboardShell.tsx` — layout com margem responsiva e foco (`lg:ml-64` vs `lg:ml-20`).
- `DashboardAppCard.tsx` — card de aplicação com ações rápidas (novo).
- `AppTabs.tsx` — abas da página de detalhes (novo).
- `AppControls.tsx` — Iniciar/Reiniciar/Parar/Renomear/Trocar Token/Servidor
  principal (com modais + ConfirmDialog).
- `BotStatusBadge.tsx` / `BotStatusIndicator.tsx` — presença do bot (polling 30s).
- `config/LojaEditor.tsx` / `config/ProtectionEditor.tsx` — editores de módulos.
- Vendas: `SalesDashboard`, `OrdersList`, `ProductsManager`, `StorePaymentForm`.
- `LoginForm`, `SignOutButton`, `CopyButton`, `ChunkRecovery`, `Toast`,
  `PageState`, `RenewalAlerts`, `RenewPanel`, `PurchasePaymentPanel`, etc.

### 3.4 Camada de dados (`site/lib/`)

- `actions/` — Server Actions: `context` (sessão, stores, ACL), `apps`,
  `admin`, `purchases`, `bot-config`, `vendas`.
- `auth.ts` + `next-auth.d.ts` — NextAuth (Discord OAuth, JWT 30d, cookies
  Secure, callbacks anti-open-redirect).
- `require-admin.ts` — `getSessionUser`/`requireUser` com retry de sessão.
- `drox-bot-config.ts` + `drox-defaults.ts` + `bot-config-modules.ts` +
  `bot-config-schemas.ts` + `bot-config-meta.ts` — **camada de sincronização com o
  DROX**: barramento de eventos + Change Stream no banco `drox_bots`
  (collections com nome `/^\d{15,25}$/`), `getBotDocument`/`saveBotDocument`,
  `toPlainJson`, módulos validados por zod strict, defaults por módulo.
- `webhooks.ts`, `status.ts`, `vendas.ts`, `types.ts`, `errors.ts`.
- `hooks/useBotConfig.ts` — carga/validação de config de bot.

---

## 4. Integração Zuros ↔ DROX via MongoDB

### 4.1 Collections compartilhadas

| Collection | Banco | Escrita por | Lida por |
|---|---|---|---|
| `applications` | principal | bot (criação/renovação), cronjobs | painel (lista/detalhe) |
| `stores` | principal | bot (config), admin | painel |
| `products` | principal | bot, admin, releases | painel, cronjobs |
| `carts-buy` / `carts-renew` | principal | bot (compra), cronjobs (pagamento) | painel (vendas) |
| `coupons` | principal | bot/admin | bot (compra), painel |
| `extracts` | principal | cronjobs (changeBalance) | painel (extrato) |
| `user-settings` | principal | bot (gateway), painel (admin) | bot, cronjobs, painel |
| `global-settings` | principal | admin | bot (presences) |
| **`<botId>` (drox_bots)** | `drox_bots` | **DROX Bot** (loja_products etc.) | painel (config DROX/vendas) |

### 4.2 Fluxos principais

1. **Compra (Discord)**: `/buy` → thread + `carts-buy` → cliente paga PIX →
   cronjob 5s (ou webhook EFI/Promisse) confirma → `changeBalance` +
   `carts-buy.step=payment-confirmed` → `purchases.ts` entrega a aplicação
   (cria na CamposCloud) → `applications`.
2. **Renovação**: `/apps` renovar → `carts-renew` → PIX → cronjob 5s →
   estende `expiresAt` ou marca `lifetime`; notifica.
3. **Expiração**: cronjob 3s → `grace_period` (4 dias, app parada) → delete.
4. **Release**: upload no painel → `releases.ts` grava `.zip` +
   `needToUpdateApplications` → cronjob 5s atualiza todas as apps do produto.
5. **Config DROX**: painel lê/escreve o doc `<botId>` do banco `drox_bots`
   (via `getBotDocument`/`saveBotDocument`); Change Stream avisa o editor em
   tempo real; o DROX Bot consome esses docs no servidor dele.
6. **Telemetria**: cada DROX Bot POSTa em `/api/bot-telemetry` (`BOT_TOKEN` do
   gerente) → grava atividade → `getPlatformTelemetry` no painel.
7. **Status das instâncias**: `status-cache.ts` + SDK CamposCloud
   (`getCachedInstanceStatus`) → badges Online/Offline com TTL 20s.

---

## 5. Autenticação e bug de logout

### Configuração (NextAuth v4 + Discord OAuth2)

- Escopo `identify email guilds`; **JWT** com `maxAge 30d` e `updateAge 1d`.
- Cookies httpOnly/sameSite=lax; nomes `__Secure-*` somente quando
  `NEXTAUTH_URL` é `https:` (divergência de protocolo **invalida sessões**).
- `secret` = `NEXTAUTH_SECRET` (em produção, ausência → erro no boot).
- Callbacks `jwt`/`session` persistem `discordId`/perfil; `redirect` bloqueia
  open-redirect.

### Diagnóstico do "logout automático"

- **Causa raiz**: `getServerSession` retornando `null` de forma **intermitente**
  durante render RSC/Server Actions de navegação (NextAuth v4 + Next 14.2),
  causando `ActionError("Não autenticado.")` (context.ts) ou `redirect("/login")`
  (require-admin.ts). Não há `signOut()` automático em lugar nenhum.
- Amplificadores: `SessionProvider` fazia refetch ao focar a janela; relógio do
  VM pode derivar; `NEXTAUTH_URL=http://localhost:3000` nos `.env` exige que o
  host de produção sobrescreva antes do login.

### Correções aplicadas

1. `SessionProvider`: `refetchOnWindowFocus={false}` — elimina o disparo de
   `/api/auth/session` ao focar aba/janela (que podia responder `{}` e marcar
   unauthenticated).
2. `require-admin.ts` e `actions/context.ts`: retry de sessão com **backoff
   (3 tentativas: 0ms, 50ms, 150ms)** — reduz os "Não autenticado" transitórios
   durante navegação.

> Recomendação de produção: garantir `NEXTAUTH_URL` pública https e
> `NEXTAUTH_SECRET` estável injetadas pelo host (o `scripts/create-deploy-zip.cjs`
> exclui `.env*` do pacote).

---

## 6. Personalizações entregues

1. **Tema escuro navy**: fundo `#0a0e27`, superfícies navy (`--surface`,
   `--surface-raised`, escala `zinc` remapeada), primário `#5865F2`, destaque
   `#EB459E` (escala `magenta`).
2. **Tipografia**: Poppins (títulos `h1–h4` + `.font-display`) e Inter (corpo),
   via `next/font/google` no `layout.tsx` (`--font-display`/`--font-sans`).
3. **Dashboard**: cards novos (`DashboardAppCard`) com status colorido,
   plano (validade), versão e ações rápidas **Iniciar/Pausar/Reiniciar** + botão
   destacado **Configurar DROX**.
4. **Detalhes em abas** (`AppTabs`): **Informações**, **Controles** e
   **Configurar DROX** (editor embutido, sem sair do painel).
5. **Sidebar**: logo Z gradiente, menu (Dashboard/Faturas/Configurações/Tutoriais/
   Suporte), perfil+logout na base, **modo foco** (rail estreito) no configurador.
6. **"Todos os Bots"**: lista expansível com **chevron**, **bot ativo destacado
   no topo** e sub-links (Detalhes/Configurar DROX/Vendas).
7. **Fix de logout** (seção 5).

---

## 7. Bugs encontrados (histórico) e corrigidos

| Onde | Bug | Correção |
|---|---|---|
| `cronjobs.ts` (PIX) | Saldo creditado sem desconto do cupom (loja pagava o cupom) | credita `price*(1-discount/100)` |
| `cronjobs.ts` | `return` encerrava o loop de produtos ao encontrar um sem pendências | `continue` |
| `cronjobs.ts` | `zipFile.toBuffer()` dentro do loop de apps (perf) | serializa uma vez |
| `cronjobs.ts` | `renewCartsMessage` vazava memória | `delete` após fechar/expirar |
| `vendas.actions.ts` | shape do `loja_products` errado (produtos aninhados) | produtos são chaves de topo do doc |
| `vendas.actions.ts` | `MapIterator` não iterável no target TS | `Array.from(...)` |
| Session | logout intermitente | retry com backoff + `refetchOnWindowFocus=false` |

---

## 8. Como rodar

### Local (desenvolvimento)

```bash
# 1) credenciais: preencher .env (veja src/config/env.ts e site/lib/auth.ts)
#    .env  → usado pelo runtime do bot/servidor (npm run dev)
#    .env.production → usado por builds de produção

# 2) instalar dependências (raiz usa workspace? se não, instalar nos dois)
npm install            # raiz (bot)
npm --prefix site install   # painel

# 3) subir (dev = build de produção do painel + servidor tsx)
npm run dev
# painel em http://localhost:3000  |  login com Discord
```

### Produção

```bash
# o servidor usa o build de produção em site/next-build-visual (imutável)
npm run build          # gera/valida o build do painel (scripts/ensure-site.cjs)
npm start              # sobe servidor + worker (production)
```

- Env obrigatórias em produção: `BOT_TOKEN`, `MONGO_DB_URL`, `DROX_BOTS_MONGO_URI`,
  `OWNER_ID`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `NEXTAUTH_SECRET`,
  `NEXTAUTH_URL` (https pública).
- Webhooks de pagamento: apontar para `https://<painel>/api/webhooks/efi` e
  `/api/webhooks/promissepay` com os secrets `EFI_WEBHOOK_SECRET` /
  `PROMISSEPAY_WEBHOOK_SECRET`.
- Deploy zip: `scripts/create-deploy-zip.cjs` (exclui `.env*` — o host precisa
  injetar as envs no secret manager).

### Testes

```bash
npm --prefix site test   # node --test (releases, bot-config-modules)
```

---

## 9. Auditoria complementar — páginas da conta

- **Extrato**: implementado com dados reais de `extracts`, limitado às lojas
  cujo `ownerId_campos` pertence ao usuário Discord autenticado. A consulta é
  ordenada por data, limitada a 200 registros e usa o índice composto
  `{ storeId: 1, createdAt: -1 }` já existente.
- **Afiliados**: o programa ainda não possui fonte de dados; a tela foi mantida
  como anúncio explícito de recurso futuro, sem mensagem de erro de instalação.
- **Notificações**: não há hoje um modelo de notificações por usuário. A tela
  comunica que o recurso está em desenvolvimento, sem apresentar um vazio que
  sugira uma integração já funcional.
- **Faturas**: `/dashboard/invoices` é a rota canônica e reúne compras e
  renovações de toda a conta. A rota antiga `/dashboard/account/invoices`
  redireciona para ela.
- **Checkout**: a página de carrinho agora diferencia carrinho expirado,
  compra já concluída e carrinho indisponível, oferecendo caminhos seguros de
  volta ao dashboard ou de criação de uma nova compra.
- **Vendas por bot**: pedidos, clientes, carrinhos e indicadores da rota
  `/dashboard/[appId]/vendas` são isolados pelo `applicationId` automático do
  bot, sem agregação por `storeId`. O carrinho de compra recebe esse vínculo
  automaticamente após a entrega da aplicação. Foram adicionados os índices
  `{ applicationId: 1, createdAt: -1 }` em `carts-buy` e `carts-renew`.

### Integração CamposCloud

- O token canônico é `settings.token_campos`; `token_campos` no topo é aceito
  apenas para migração e removido na próxima gravação.
- O cache do SDK agrega inicializações concorrentes, mantém credenciais válidas
  por cinco minutos e revalida falhas após 15 segundos.
- A validação inicial possui timeout de 15 segundos e não registra tokens.
- O uso do plano é consultado em paralelo e valores negativos/inválidos de RAM
  são normalizados.
- Cada aplicação persiste seu próprio `serverId`, impedindo que troca de token
  reverta o servidor principal para o team da loja.
- `appId` remoto possui índice único esparso, evitando duas aplicações locais
  apontarem para a mesma aplicação hospedada.
- Falhas 404 são diferenciadas de indisponibilidade/erro HTTP da CamposCloud;
  start, stop e restart retornam mensagens contextualizadas.
- Redeploy é abortado quando o arquivo de release não existe, inclusive quando
  `releaseExists` retorna `false` sem lançar exceção.
