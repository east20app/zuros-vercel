# ZUROS Client Bot

Bot oficial e independente para clientes controlarem aplicações ZUROS pelo Discord. Ele não acessa MongoDB, CamposCloud ou gateways diretamente; toda operação passa pela API privada do painel.

## Comandos

- `/app` e `/apps`: lista e controla aplicações.
- `/comprar`: escolhe produto e plano e gera o pagamento PIX.
- `/renovar`: renova uma aplicação e gera o pagamento PIX.
- `/status`: verifica a conexão com a API.
- `/central`: publica no canal uma central em Components V2; cada botão abre um painel privado para quem clicar.
- `/aquisicao`: publica o catálogo real em Components V2; a seleção do produto, plano e pagamento acontece de forma privada.
- `/boas-vindas`: publica a apresentação institucional da ZUROS com acessos para planos, painel e suporte.

O painel de uma aplicação permite iniciar, reiniciar, parar, solicitar atualização, alterar nome, atualizar token, escolher servidor principal, abrir o dashboard e adicionar o bot ao servidor.

Os pagamentos PIX são acompanhados automaticamente a cada cinco segundos. Quando uma compra é aprovada, a mensagem de cobrança é substituída pela confirmação e pelo acesso à configuração. Renovações aprovadas também atualizam o painel sem exigir um novo comando.

## Instalação

```bash
cd services/zuros-client-bot
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
copy .env.example .env
python bot.py
```

No Linux, use `.venv/bin/pip` e `.venv/bin/python`.

## Configuração do site

Configure `ZUROS_CLIENT_BOT_SECRET` no site com um segredo aleatório de pelo menos 32 caracteres. Coloque exatamente o mesmo valor em `ZUROS_CLIENT_BOT_SECRET` no bot. `ZUROS_BRIDGE_CREDENTIAL` continua aceito no site para compatibilidade. O token do Discord nunca deve ser usado como credencial da API.

Configure também `ZUROS_CLIENT_BOT_ID` nos dois ambientes com o mesmo identificador. Reinicie o bot e publique novamente o site depois de alterar as variáveis.

## Corrigir erro de assinatura

Ao iniciar, o bot registra `API`, `bot_id` e `assinatura`. O valor de `assinatura` é somente uma impressão SHA-256 de 12 caracteres e não revela o segredo.

Se a API recusar a autenticação:

1. confirme que a versão atual de `/api/client-bot/v1` está publicada;
2. copie o mesmo segredo para `ZUROS_CLIENT_BOT_SECRET` no site e no arquivo `.env` do bot;
3. confirme que `ZUROS_CLIENT_BOT_ID` é idêntico nos dois ambientes;
4. publique o site e reinicie o bot;
5. execute `python diagnostico.py` dentro da pasta do bot.

Evite aspas, espaços nas pontas e `#` no segredo. Uma forma segura de gerar a chave é `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Segurança

- HMAC-SHA256 em todas as requisições.
- Timestamp e nonce contra replay.
- Respostas efêmeras.
- Componentes vinculados ao usuário que abriu o painel.
- Token enviado somente no corpo assinado e nunca exibido novamente.
- Sem credenciais do banco ou provedores no processo do bot.
- Rate limit local contra cliques repetidos.
- Request ID exibido ao usuário quando a API falha.

## Desenvolvimento

Defina `DISCORD_GUILD_ID` para registrar comandos imediatamente em um servidor de teste. Sem essa variável, os comandos são globais e podem levar alguns minutos para aparecer.

```bash
python -m compileall -q .
ruff check .
black --check .
pytest -q
```

## Limitação atual

Os módulos ZUROS Auth, notificações e SSE dependem de rotas que ainda não existem em `/api/client-bot/v1`. O código não simula essas funções. Elas devem ser adicionadas ao site antes de serem expostas no bot.
