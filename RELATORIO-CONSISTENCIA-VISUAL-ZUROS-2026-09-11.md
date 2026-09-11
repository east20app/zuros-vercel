# Auditoria de consistência visual da ZUROS

## Escopo

Foi revisado o conjunto de páginas do App Router e os componentes compartilhados do frontend. A revisão considerou landing page, login, planos, informações públicas, dashboard, aplicações, configuração, autenticação, backups, vendas, checkout, conta e administração.

A regra de implementação foi preservar integralmente rotas, consultas, server actions, handlers, integrações, permissões, autenticação, webhooks e regras de negócio. As mudanças desta etapa ficam restritas à apresentação visual.

## Resultado

O frontend tinha uma identidade principal baseada em fundo escuro, superfície verde-lima e bordas neutras, mas ainda apresentava outliers em módulos antigos. Foram encontrados estilos Discord, roxo, ciano e azul aplicados diretamente em componentes de configuração, autenticação, servidores, backups, telemetria e pagamentos. Também havia uso amplo de `rounded-xl` e `rounded-2xl`, causando aparência inconsistente com o padrão operacional desejado.

Foi adicionada uma camada de normalização global que:

- Mantém fundo, superfície, texto, acento e estados semânticos dentro do mesmo tema.
- Reduz raios de cards e controles para uma escala operacional comum.
- Preserva círculos apenas para avatares, indicadores e elementos que realmente precisam ser circulares.
- Uniformiza bordas e superfícies legadas.
- Mantém vermelho, âmbar, verde e azul apenas para comunicar estados semânticos.
- Reforça foco visível e comportamento responsivo.
- Não altera nomes de ações, rotas, dados, eventos ou integrações.

## Matriz de consistência

| Área | Padrão visual aplicado | Função preservada |
|---|---|---|
| Landing e páginas públicas | Fundo escuro, CTA compacto, cards com borda neutra e hierarquia editorial | Navegação, catálogo, autenticação e conteúdo público |
| Login | Superfície segura, foco evidente, campos consistentes e contraste alto | Discord, login por e-mail, código e callback |
| Dashboard | Cabeçalho, resumo, status, cards operacionais e lista de aplicações no mesmo ritmo | Consulta e controles das aplicações |
| Detalhes da aplicação | Painéis, métricas, tabelas e alertas com superfícies unificadas | Status, ações, histórico e configuração |
| Vendas | Tabelas densas, filtros e estados semânticos consistentes | Pedidos, produtos, clientes, carrinhos e pagamentos |
| Checkout | Campos, avisos, resumo e CTA com a mesma linguagem | Carrinho, PIX, cupons, pagamento e entrega |
| Configuração | Módulos antigos normalizados para a superfície ZUROS | Salvamento, validação e integração com bot |
| Autenticação ZUROS | Cards, formulários, logs e estados com bordas e cores comuns | OAuth, cargos, mensagens, equipe e recuperação |
| Conta e notificações | Cabeçalho contextual, categorias e preferências por dispositivo | Perfil, extrato, afiliados, faturas e notificações |
| Administração | Painéis, tabelas, ações e status no mesmo sistema | Produtos, releases, cupons, pagamentos e extratos |

## Sistema de e-mails

O anexo define a direção enterprise para e-mails. O frontend/backend atual possui eventos transacionais reais para código de login, carrinho aberto, pagamento confirmado, lembrete de renovação e atualização de release. A especificação visual deve ser aplicada a esses eventos sem criar novos disparos.

O template-base recomendado usa `#0B0F14` como fundo, `#111827` como superfície, `#1F2937` como borda, `#D6FF63` como acento, `#F8FAFC` para texto principal e `#94A3B8` para texto auxiliar. Todos os e-mails devem ter preheader, logo ZUROS, explicação do evento real, dados objetivos, CTA contextual, links úteis e rodapé responsivo.

A implementação de templates HTML efetivos foi mantida fora desta alteração porque os templates ativos pertencem à camada de envio transacional no backend, que não pode ser alterada conforme a regra do projeto. O relatório anterior contém o plano de implementação compatível com essa restrição.

## Verificação

A normalização foi aplicada somente em `site/app/globals.css` e não modifica código de negócio. A validação deve ser executada com `npm run typecheck`, `npm run lint`, `npm test` e `npm run build:next` antes do merge.
