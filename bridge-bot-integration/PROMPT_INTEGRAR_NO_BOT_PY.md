# PROMPT PARA INTEGRAR NO BOT.PY — ZUROS BRIDGE BOT

Você está alterando exclusivamente o Zuros Bridge Bot oficial. Não é o DROX principal e não deve importar nem modificar os 97 handlers do bot de loja.

## Arquivos fornecidos

- `zuros_integration_client.py`: cliente assíncrono pronto.
- `.env.example`: configuração mínima.

## Objetivo

Integre `ZurosIntegrationClient` ao `bot.py` existente sem apagar comandos, eventos ou fallbacks locais.

## Regras obrigatórias

1. Detecte se o projeto usa `discord.py`, `disnake` ou `nextcord` e mantenha a biblioteca atual. Não migre framework.
2. Carregue somente:
   - `DISCORD_BOT_TOKEN`
   - `ZUROS_APP_BASE_URL=https://app.zuros.site`
   - `ZUROS_BRIDGE_CREDENTIAL`
   - `ZUROS_BRIDGE_VERSION`
3. Crie uma única instância de `ZurosIntegrationClient` no startup e feche-a no shutdown.
4. Baixe `get_config()` no startup. Se falhar, use as variáveis antigas como fallback e registre apenas um warning sem secrets.
5. Preserve os comandos `/setup_servidor`, `/publicar_verificacao`, `/publicar_produtos` e `/zuros_status`.
6. `/publicar_produtos` deve usar `get_products()` e recorrer aos links locais somente se a API estiver indisponível.
7. `/zuros_status` deve combinar `get_health()`, `get_stats()` e `get_auth_stats(auth_id)`.
8. O botão persistente deve manter exatamente `custom_id="Cloud_GetAuthLink"`. Cada clique chama `create_auth_link(auth_id,user_id,guild_id)` e responde de forma ephemeral com um botão URL. Nunca use link OAuth fixo.
9. Inicie uma única task de SSE usando `reconnecting_events`. Processe:
   - `auth.completed`: aplicar cargo verificado e remover autorole quando configurado;
   - `auth.revoked`: remover cargo verificado.
10. Ao iniciar e após reconnect, chame `get_pending_role_sync()`. Para cada item, aplique idempotentemente e envie `ack_role_sync()`.
11. Suporte operações `apply_verified_role`, `remove_verified_role` e `remove_autorole`.
12. Antes de alterar cargos, valide servidor autorizado, membro, `manage_roles` e hierarquia. Em falha, ACK `failed`, `retryable=true` apenas para erros transitórios, usando código curto como `ROLE_HIERARCHY` — nunca stack trace.
13. Envie `heartbeat()` a cada 60 segundos. O loop de status/canais roda a cada 5 minutos e só renomeia quando o nome mudou.
14. Garanta uma única task de reconnect, heartbeat e status. Cancele e aguarde todas no shutdown. Não deixe `Unclosed client session`.
15. Nunca registre credential, Authorization, token Discord, OAuth token, Mongo URI ou conteúdo de `.env`.
16. Mantenha adapters das classes antigas durante a migração. Não remova o fallback até o E2E passar.

## Estrutura sugerida no bot.py

- `setup_hook`/`on_ready` idempotente: iniciar cliente, carregar config, consultar pendências, iniciar SSE/heartbeat/status.
- `close`: definir stop event, cancelar tasks, aguardar com `return_exceptions=True`, fechar cliente e chamar o close original do framework.
- Armazenar tasks em `self.zuros_tasks` e impedir duplicação em reconexões do Discord.

## Testes obrigatórios

Use API fake e teste: config remota/fallback, health, produtos, auth-link individual, SSE completed/revoked, reconnect com Last-Event-ID, aplicação/remoção idempotente de cargos, pending+ACK, heartbeat e shutdown sem sessão aberta.

Não invente endpoints nem formatos. O cliente fornecido já usa `/api/integration/v1` e o wrapper `{success,data,error,request_id}`.