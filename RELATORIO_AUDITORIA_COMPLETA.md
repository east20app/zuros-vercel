# Relatório de auditoria completa — ZUROS

Data: 28/08/2026
Branch: codex/platform-hardening

## Resultado executivo

O monorepo foi revisado nos fluxos de painel, catálogo, checkout PIX, gateways, webhooks, cupons, entrega, releases, integração DROX, ZUROS Auth, responsividade e pipeline. O Disparador de DMs não foi alterado.

## Alterações principais

- Next.js 15.5.21 e React 19, sem vulnerabilidades conhecidas no audit de produção.
- Parâmetros assíncronos do Next 15 migrados; tipos e lint do site aprovados.
- Checkout monetário calculado em centavos inteiros.
- Serviço idempotente de confirmação para Efí, PromissePay e Sharpify.
- Ledger e eventos de pagamento com chaves únicas para reduzir crédito e entrega duplicados.
- Reserva de cupom com consumo ou liberação controlada.
- Webhooks com limite de corpo, resposta sanitizada e autenticação por integração.
- Polling de pagamentos com lote e backoff.
- Estados explícitos de entrega: payment_confirmed, provisioning, partial_delivery, delivered e retryable_error.
- Releases com reserva atômica de versão, SHA-256, validação de ZIP e estados uploading, published e failed.
- Interface de releases mostra fila, erro, integridade e ações válidas.
- Painel responsivo reforçado para iPhone, com inputs de 16 px e contenção horizontal.
- Menu do bot contém somente Iniciar, Reiniciar e Parar nos controles rápidos.
- ZUROS Auth integrado ao mesmo painel por licença e assistente de configuração.
- PWA, manifest, service worker e preferências de notificação adicionados.
- Varredura de segredos considera apenas arquivos rastreados; arquivos .env locais permanecem ignorados.
- Caches Python e arquivos compilados não entram no Git.

## Segurança

Tokens não são retornados no DTO público de detalhes da aplicação. Os webhooks não confiam apenas no payload recebido: a confirmação consulta o provedor. Credenciais permanecem exclusivamente em ações do servidor.

A migração criptográfica de credenciais legadas não foi ativada automaticamente. Alterar desserialização de credenciais e aprovação financeira sem migração transacional foi bloqueado pela proteção do ambiente. Recomendação: criar backup, chave DATA_ENCRYPTION_KEY, migração versionada e rollback antes de habilitar criptografia em repouso.

## Limites e operação

- O painel Vercel não substitui o worker persistente do bot.
- Reconciliação recorrente e bot Discord devem rodar no processo de hospedagem persistente.
- A PromissePay precisa ter o webhook configurado no painel do provedor; o polling continua como fallback.
- Usuários Sharpify antigos precisam salvar novamente as credenciais uma vez para gerar o identificador de webhook.
- O bot DROX legado compila, mas não foi reformatado em massa para evitar alterar comportamento e arquivos protegidos.

## Validações

- Secret scan: aprovado.
- TypeScript raiz e site: aprovado.
- ESLint do site: aprovado.
- Testes Node: 13 aprovados.
- Python compileall: aprovado.
- npm audit raiz e site: 0 vulnerabilidades.
- Build de produção: consultar production-build.log.
- Ruff e Black: aplicados ao cliente novo de integração e testes; o legado DROX permanece fora do gate de estilo.