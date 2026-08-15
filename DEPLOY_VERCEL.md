# Deploy na Vercel

O painel Next.js e suas rotas HTTP estão preparados para deploy a partir da raiz
do repositório. Importe o repositório na Vercel sem alterar o **Root Directory**.
O `vercel.json` instala as dependências da raiz e de `site`, compila o painel e
publica `site/.next`.

Cadastre as variáveis de `.env.example` para Production, Preview e Development.
Em `NEXTAUTH_URL` e `APP_URL`, use o domínio público da produção. No Discord
Developer Portal, adicione o callback OAuth:

`https://SEU-DOMINIO/api/auth/callback/discord`

O arquivo `vercel-env.example` contém a lista completa pronta para copiar. Não
renomeie esse arquivo para `.env` dentro do ZIP e nunca publique valores reais:
adicione-os em **Settings → Environment Variables** no projeto da Vercel.

## Limites da plataforma

O painel funciona sem iniciar o bot gerenciador e não exige `BOT_TOKEN`. As
operações administrativas equivalentes aos comandos são executadas pelo próprio
site. Os bots dos clientes continuam sendo criados, configurados, reiniciados e
enviados ao provedor diretamente pelo painel.

Eventos nativos do Discord (slash commands, mensagens e presença) só existem
dentro dos bots dos clientes hospedados, pois exigem uma conexão Discord Gateway.

Uploads de releases usam o disco local em `releases/`. O filesystem das funções
da Vercel não é persistente; mantenha essa operação no serviço contínuo até migrar
os arquivos para armazenamento de objetos.
