# Bot separado de suporte da ZUROS

O bot de suporte usa o mesmo MongoDB, os mesmos modelos de aplicações e a mesma integração CamposCloud do bot principal, mas roda como um processo independente. Ele não importa `src/index.ts` e, portanto, não inicializa o worker principal nem o servidor web.

## Funcionalidades incluídas

- `/apps`: lista as aplicações adquiridas pelo usuário;
- consulta de status da aplicação;
- iniciar, reiniciar e parar aplicação usando as operações existentes da CamposCloud;
- `/ticket`: cria um canal privado persistido no MongoDB;
- `/support-status`: consulta restrita à equipe;
- categorias de atendimento e bloqueio de tickets duplicados;
- logs de operação sem tokens ou segredos.

## Variáveis obrigatórias

```env
SUPPORT_BOT_TOKEN=
SUPPORT_BOT_CLIENT_ID=
SUPPORT_GUILD_ID=
SUPPORT_CATEGORY_ID=
SUPPORT_ROLE_IDS=123456789012345678,234567890123456789
SUPPORT_ADMIN_ROLE_IDS=345678901234567890
```

Também são necessárias as variáveis já usadas pelo projeto:

```env
MONGO_DB_URL=
DROX_BOTS_MONGO_URI=
CAMPOS_API_TOKEN=
DATA_ENCRYPTION_KEY=
```

`SUPPORT_GUILD_ID` é recomendado durante a configuração. Com ele, os comandos são registrados rapidamente apenas no servidor de suporte. Sem ele, o registro é global e pode demorar até uma hora para aparecer.

## Permissões do bot

Conceda somente:

- View Channels;
- Send Messages;
- Embed Links;
- Read Message History;
- Manage Channels, se o bot criar tickets;
- Manage Threads, caso tickets sejam implementados como threads.

Não use Administrator por padrão.

## Execução

```bash
npm install
npm run dev:support
```

Produção:

```bash
npm run start:support
```

O processo deve ser executado separado do bot principal, com restart automático pelo gerenciador da hospedagem.

## Segurança

O bot verifica o `ownerId` da aplicação antes de mostrar ou operar uma aplicação. Ações administrativas futuras devem ter uma camada adicional de cargo e auditoria. Tokens Discord, credenciais CamposCloud e chaves de pagamento nunca devem ser enviados para mensagens, embeds ou logs.
