# Auditoria de controle de acesso — ZUROS APP

Data: 14/08/2026

## Resultado

Foram revisadas as entradas de servidor em `site/lib/actions`, `site/app/api`, `src/commands` e `src/events` que operam com identificadores de loja, aplicação, produto, cupom, carrinho e usuário.

| Arquivo | Função/área | Status | Risco anterior |
|---|---|---|---|
| `src/functions/acl.ts` | `getUserHasPermissionOnStore` | Corrigido | Comparações com valores ausentes poderiam reconhecer proprietário incorretamente. |
| `src/functions/acl.ts` | `getUserHasPermissionOnBOT` | Corrigido | A comparação não falhava explicitamente quando `OWNER_ID` estava ausente. |
| `site/lib/actions/admin.actions.ts` | `listPendingPayments` | Corrigido | Um `storeId` explícito não era autorizado dentro da própria action (IDOR). |
| `site/lib/actions/admin.actions.ts` | `getUserStoreIds` e `listAdminStores` | Corrigido | Qualquer permissão da loja era tratada como acesso administrativo. Agora exige `admin`. |
| `site/lib/actions/admin.actions.ts` | `createStore` | Corrigido | Qualquer usuário autenticado podia criar lojas. Agora exige o proprietário global. |
| `site/lib/actions/admin.actions.ts` | `approvePayment` | Corrigido | Uma renovação inconsistente poderia atualizar aplicação de outra loja. |
| `site/lib/actions/context.ts` | `getStoresForUser` | Corrigido | APIs administrativas aceitavam qualquer entrada em `permissions`, sem exigir `admin`. |
| `site/lib/actions/context.ts` | `getOwnerDiscordId` | Corrigido | A resolução do SDK não estava limitada à loja única configurada. |
| `site/app/api/bot-telemetry/route.ts` | `POST` | Corrigido | Token era comparado por consulta comum; agora há comparação em tempo constante. |
| `src/commands/config/components/advanced-config.ts` | proprietário da loja | Corrigido | Comparação redundante não falhava fechada para valores ausentes. |
| `site/lib/actions/apps.actions.ts` | aplicações e renovações | OK | Sessão e posse são verificadas por `assertOwnsApp` ou pelo `userId` do carrinho. |
| `site/lib/actions/purchases.actions.ts` | compra e entrega | OK | Todas as operações mutáveis vinculam o carrinho ao usuário autenticado. |
| `site/lib/actions/vendas.actions.ts` | vendas/configuração DROX | OK | `resolveAppContext` valida o proprietário e converte o ID público para o ID interno. |
| `site/lib/actions/bot-config.actions.ts` | módulos do bot | OK | `ownedActiveApplication` exige sessão, proprietário e aplicação ativa. |
| `site/app/api/products/[productId]/releases/route.ts` | POST/GET/DELETE | OK | Sessão obrigatória e produto vinculado à loja autorizada na integração de releases. |
| `site/app/api/webhooks/*` | webhooks de pagamento | OK | Segredo obrigatório, HMAC e `timingSafeEqual`; falha fechada sem segredo. |
| `site/lib/actions/site-users.actions.ts` | usuários do site | OK (single-tenant) | Dados globais ficam disponíveis somente ao admin da única loja ou proprietário global. |

## Validação

- `npm --prefix site test`: 9 testes aprovados.
- TypeScript e ESLint devem ser executados antes de cada publicação.

