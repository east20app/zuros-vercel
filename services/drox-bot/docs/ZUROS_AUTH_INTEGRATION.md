# Integração Zuros Auth

A integração usa exclusivamente o contrato REST oficial em `/internal/*`.
O Auth ID e a Bot Credential podem ser configurados pelo botão Colocar Key no painel Cloud.

## Configuração

Copie as variáveis de `.env.example` para o ambiente real do processo e reinicie o bot.
O processo precisa de `ZUROS_AUTH_ID` e `ZUROS_BOT_CREDENTIAL`. A resolução de
Auth por servidor usa também `BOT_GATEWAY_SHARED_SECRET`.

## Operação

- `/zuros status`: testa a credencial e mostra o estado da integração.
- `/zuros publicar`: busca a mensagem no backend e publica com a view persistente.
- `/zuros revogar`: revoga um usuário.
- `/zuros ressincronizar`: solicita reentrada/ressincronização.
- O worker consulta `/internal/role-sync/pending` a cada 15 segundos e confirma cada item.
- Recursos protegidos devem chamar `require_zuros_verification(inter)`; erros de rede
  bloqueiam o acesso (fail-closed).

## Diagnóstico do botão

O botão público usa `custom_id=Cloud_GetAuthLink`. A resposta ao clique é uma nova
mensagem efêmera (`with_message=True`), evitando editar a mensagem Components V2
original. O URL é colocado no botão link, nunca no texto da mensagem.

Se o callback falhar, confira no painel Zuros se o redirect configurado é
`https://zuros-auth.vercel.app/oauth/callback`, além do Auth ID, credencial do bot,
permissão de cargos e hierarquia do cargo verificado.
