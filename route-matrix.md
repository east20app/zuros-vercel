# Matriz de rotas

## Públicas

| Rota | Finalidade | Acesso |
| --- | --- | --- |
| / | Página inicial e catálogo | Público |
| /planos | Planos e início de compra | Público autenticável |
| /termos | Termos de serviço | Público |
| /privacidade | Política de privacidade | Público |

## Usuário

| Rota | Finalidade | Proteção |
| --- | --- | --- |
| /dashboard | Minhas aplicações e licenças | Sessão Discord |
| /dashboard/[appId] | Visão geral do bot | Dono da aplicação |
| /dashboard/[appId]/config/[modulo] | Configuração por módulo DROX | Dono da aplicação |
| /dashboard/[appId]/vendas | Operação da loja | Dono da aplicação |
| /dashboard/[appId]/servidores | Seleção do servidor principal | Dono da aplicação |
| /dashboard/store/cart/[cartId] | Checkout PIX e entrega | Dono do carrinho |
| /dashboard/auth/[licenseId] | Painel ZUROS Auth | Dono da licença |
| /dashboard/account/notifications | Preferências PWA | Sessão Discord |
| /dashboard/invoices | Faturas e comprovantes | Sessão Discord |

## Administração

| Rota | Finalidade | Proteção |
| --- | --- | --- |
| /admin | Loja principal | Admin |
| /admin/users | Usuários autenticados | Admin |
| /admin/[storeId]/products | Produtos | Permissão da loja |
| /admin/[storeId]/payments | Pagamentos | Permissão da loja |
| /admin/[storeId]/products/[productId]/releases | Releases e atualização | Permissão da loja |
| /admin/settings | Gateways e integrações | Proprietário |
| /sharpify | Pagamentos e saques Sharpify | Proprietário |

## API

| Rota | Método | Validação |
| --- | --- | --- |
| /api/webhooks/efi e /pix | POST | HMAC de URL, limite de corpo, consulta Efí |
| /api/webhooks/promissepay | POST | Token de callback, limite, consulta PromissePay |
| /api/webhooks/sharpify | POST | Identificador e assinatura por integração |
| /api/products/[productId]/releases | GET/POST/DELETE | Sessão e permissão administrativa |
| /api/integration/v1/* | Vários | Credencial por aplicação e rate limit |

Rotas dinâmicas usam identificador público do bot, mantendo o ID interno apenas no servidor quando necessário.