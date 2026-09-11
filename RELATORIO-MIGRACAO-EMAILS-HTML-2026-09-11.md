# Migração completa dos e-mails ZUROS para layout visual

## Escopo executado

Todos os eventos transacionais existentes passaram a utilizar o layout central `renderEmail()`, com exceção deliberada do caminho de release que recebe um template HTML customizado em `notes`. Esse caminho continua preservado com `isTemplate`, `replaceTemplateTokens` e `htmlToText`, conforme a regra do projeto.

Nenhuma assinatura pública, chamada existente, destinatário, assunto, regra de expiração, limite de envio, consulta de usuário, transporte SMTP ou regra de negócio foi alterada.

## Layout central

O layout único está em `src/lib/email-layout.ts`. Ele fornece `renderEmail()`, `renderButton()`, `renderFieldsTable()`, `absoluteUrl()` e `esc()`.

Todo link gerado pelo layout recebe `utm_source=email`, `utm_medium=transactional` e `utm_campaign` do evento. O HTML inclui preheader, marca ZUROS, eyebrow, hero, tabela estruturada, CTA primário, CTA secundário quando aplicável, rodapé corporativo e versão textual correspondente.

## Funções migradas

| Função | Campaign | CTA principal |
|---|---|---|
| `sendLoginAlert` | `login_alert` | Revisar Segurança |
| `sendCartOpenedAlert` | `cart_opened` | Abrir Pagamento |
| `sendPaymentConfirmedAlert` | `payment_confirmed` | Acessar Dashboard |
| `sendRenewalReminder` | `renewal_reminder` | Renovar Agora |
| `sendReleaseUpdateAlert` fallback | `release_update` | Ver Atualização |
| Endpoint de código de acesso | `login_code` | Abrir Dashboard |

## Dados preservados

O alerta de login mantém método, data, IP e localização aproximada. O carrinho mantém produto, plano, valor e expiração. O pagamento mantém produto, plano, valor e os campos condicionais de aplicação e validade. A renovação mantém aplicação, vencimento e dias restantes. O release mantém produto, versão e notas, incluindo templates HTML customizados.

## Eventos novos

O repositório atual não possui funções ou call sites para PIX gerado, pagamento recusado, carrinho expirado, carrinho abandonado, renovação criada ou notificação ao dono da aplicação. Não foram inventados gatilhos ou regras para esses eventos, porque fazê-lo alteraria o comportamento de negócio protegido. O preview de pagamento recusado foi criado exclusivamente como referência visual para futura conexão ao evento real.

## Verificação

A busca nos módulos de e-mail confirmou que os fluxos comuns chamam `renderEmail()`. Não restaram strings HTML manuais em `src/functions/transactional-email.ts` ou no endpoint de login. O único HTML customizável mantido é o caminho intencional de release recebido em `notes`.

A validação passou com `npm run typecheck`, `npm run lint`, `npm --prefix site test` e `npm --prefix site run build:next`. Foram gerados três previews HTML:

- `previews/emails/pagamento-aprovado.html`
- `previews/emails/renovacao.html`
- `previews/emails/pagamento-recusado.html`
