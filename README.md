# ZUROS APP + BOT

Plataforma TypeScript que executa o painel Next.js e o bot Discord no mesmo processo, com MongoDB/Mongoose para persistência e telemetria compartilhada para acompanhar a saúde dos dois serviços.

## Requisitos

- Node.js 20 ou superior
- npm
- MongoDB acessível pelo ambiente de execução
- aplicação e token de bot do Discord

## Configuração

1. Instale todas as dependências com `npm run install:all`.
2. Configure as variáveis descritas em `src/config/env.ts` no ambiente ou no arquivo `.env` local. Nunca envie tokens, certificados ou chaves de pagamento ao repositório.
3. Execute `npm run check:secrets` antes de empacotar ou publicar.

## Desenvolvimento e validação

- `npm run dev`: inicia bot e painel pelo entrypoint `src/index.ts`.
- `npm run build`: instala, compila o painel e valida o backend TypeScript.
- `npm run build:site`: recompila somente o painel.
- `npm run typecheck`: valida backend e frontend sem emitir arquivos.
- `npm run lint`: executa o ESLint do painel.
- `npm --prefix site test`: executa os testes automatizados existentes.
- `npm run deploy:zip`: cria o pacote de implantação conforme as regras do projeto.

## Arquitetura

- `src/index.ts`: bootstrap, servidor HTTP/Next.js, cliente Discord e encerramento seguro.
- `src/commands` e `src/events`: comandos e eventos do bot.
- `src/integration`: casos de uso compartilhados pelo bot e pelo painel.
- `src/databases/schemas`: models e índices Mongoose.
- `site/app`: rotas do App Router e APIs do painel.
- `site/components`: componentes reutilizáveis da interface.

O processo principal prepara Next.js e conecta o Discord em paralelo. As falhas são reportadas separadamente pela telemetria, permitindo que o bot permaneça disponível quando a preparação do painel falhar. A configuração modular do bot é validada antes de ser persistida; alterações nessa camada devem manter as listas de documentos permitidos e seus testes sincronizados.

## Produção

Use `npm start`. O limite de heap padrão é 384 MB, definido nos scripts da raiz. Antes de reduzir ou dividir esse limite, meça o heap do processo sob carga real: um Worker Thread possui event loop isolado, mas também adiciona outro isolate V8 e uma nova conexão MongoDB, o que pode aumentar o consumo total em ambientes pequenos.
