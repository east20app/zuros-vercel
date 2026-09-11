# Auditoria completa do frontend da ZUROS

**Data:** 11 de setembro de 2026  
**Escopo:** análise do estado atual do frontend antes de qualquer alteração visual  
**Repositório:** `east20app/zuros-vercel`  
**Branch auditada:** `main`  
**Objetivo:** modernizar a experiência da ZUROS sem alterar APIs, banco de dados, integrações, permissões, autenticação, webhooks ou regras de negócio.

## 1. Conclusão executiva

O frontend atual é uma aplicação Next.js com App Router, autenticação NextAuth, server actions, componentes React reutilizáveis e uma camada visual extensa em Tailwind CSS e CSS global. O sistema possui uma cobertura funcional ampla: landing page, login, dashboard de aplicações, configuração de bots, vendas, checkout, conta, notificações, faturas, administração de lojas, produtos, releases, cupons, pagamentos, extratos e telemetria.

A interface já recebeu uma sequência de redesigns visuais recentes. Os commits mais recentes de redesign alteraram principalmente `site/app/globals.css`, `site/components/ui.tsx` e `site/components/PublicNavbar.tsx`. Isso indica que a base visual foi parcialmente modernizada, mas também gerou uma situação de camadas acumuladas: existem padrões novos e antigos convivendo, nomenclaturas visuais diferentes, raios excessivamente arredondados em vários módulos e uma hierarquia que ainda não está organizada por prioridade operacional.

A recomendação é **não começar pela troca indiscriminada de estilos**. A próxima etapa deve consolidar um design system único, criar uma arquitetura de navegação coerente e revisar as telas por fluxo. A camada de dados e as ações existentes devem permanecer como contratos imutáveis. A modernização deve trocar composição, hierarquia, feedback e acessibilidade, mas reutilizar as mesmas funções, URLs, server actions, handlers e estados de negócio.

## 2. Estado técnico encontrado

| Área | Estado atual observado | Implicação para o redesign |
|---|---|---|
| Framework | Next.js com App Router e React | A navegação deve respeitar layouts aninhados, loading, error e server/client boundaries. |
| Rotas de página | 45 arquivos `page.tsx` | O trabalho é uma reforma de produto, não apenas uma página isolada. |
| Layouts | 7 layouts | Shells públicos, de login, dashboard e administração devem ser harmonizados sem romper escopos. |
| APIs | 14 route handlers | Nenhum handler deve ser alterado para a reforma visual. |
| Componentes | 99 arquivos em `site/components` | Há material suficiente para consolidar primitivas sem reescrever a lógica de cada tela. |
| Server actions | 11 arquivos com aproximadamente 139 exports | Esses exports são contratos de negócio e devem ser preservados. |
| Estilos | `globals.css` com 3.444 linhas | É necessário reduzir sobreposição e criar tokens sem apagar classes ainda utilizadas. |
| Dados visuais | Dashboard já consulta aplicações, status, vendas, atividade, extratos e telemetria | É possível elevar a leitura executiva usando os dados existentes, sem criar métricas novas no backend. |
| Estado do Git | Clone limpo antes do script temporário de inventário | Nenhuma tela foi alterada nesta auditoria. |

## 3. Mapa atual de áreas e usuários

### 3.1 Superfícies públicas

| Área | Quem usa | Objetivo | Ações principais | Dados prioritários |
|---|---|---|---|---|
| Landing page `/` | Visitantes e clientes autenticados | Explicar a proposta da ZUROS e levar o visitante ao catálogo ou painel | Conhecer produtos, entrar, abrir dashboard, navegar para FAQ e informações institucionais | Proposta de valor, produtos, confiança, status e CTA principal |
| Planos `/planos` | Visitantes e compradores | Escolher um produto/plano | Comparar planos e iniciar compra | Produto, periodicidade, preço, condições e disponibilidade |
| Login `/login` | Clientes existentes e novos usuários | Iniciar sessão pelo Discord ou código de e-mail | Autorizar com Discord, solicitar código, confirmar código, trocar e-mail | Provedor, e-mail, estado da solicitação, erro e destino pós-login |
| Dúvidas, sobre, status, termos e privacidade | Visitantes, clientes e suporte | Reduzir dúvidas e estabelecer confiança | Ler conteúdo e navegar para suporte ou plataforma | Clareza, status, termos, privacidade e caminhos de retorno |

### 3.2 Área do cliente

| Área | Quem usa | Objetivo | Ações principais | Dados prioritários |
|---|---|---|---|---|
| Dashboard `/dashboard` | Cliente autenticado | Ver e acessar suas aplicações | Abrir aplicação, iniciar, pausar, reiniciar e configurar | Aplicação, status, plano, versão, validade e saúde |
| Detalhes `/dashboard/<appId>` | Cliente da aplicação | Operar uma aplicação específica | Consultar informações, controlar aplicação e abrir configuração | Estado operacional, versão, validade, histórico e ações disponíveis |
| Configuração `/dashboard/<appId>/config/*` | Dono ou operador do bot | Configurar módulos da aplicação | Editar loja, proteção, nuvem, automações e outros módulos | Campos configuráveis, conexão, validação, salvamento e erros |
| Servidores | Cliente que administra o bot | Ver destinos da aplicação | Consultar servidores e destinos | Servidores, status de presença e destinos de configuração |
| Vendas `/vendas/*` | Cliente que vende por Discord | Acompanhar operação comercial | Consultar visão geral, pedidos, produtos, carrinhos, clientes e pagamentos | Receita existente, pedidos, produtos, carrinhos, clientes e meios de pagamento |
| Checkout `/dashboard/store/cart/<cartId>` | Comprador | Concluir compra ou renovação | Consultar carrinho, gerar PIX, acompanhar pagamento e continuar configuração | Produto, plano, preço final, cupom, vencimento, pagamento e entrega |
| Faturas | Cliente comprador | Consultar compras e renovações | Abrir pagamento, ver pedido, continuar configuração e ver comprovante | Item, plano, valor, tipo, status e ação seguinte |
| Conta | Cliente autenticado | Administrar identidade e relacionamento | Consultar perfil, extrato, afiliados, faturas e notificações | Identidade, saldo, movimentações, indicações e alertas |
| Autenticação ZUROS | Cliente que possui licença de autenticação | Configurar controle de acesso da comunidade | Configurar identidade, OAuth, servidores, equipe, mensagens, logs e recuperação | Política de acesso, integrações, cargos, proteção e atividade |

### 3.3 Administração

| Área | Quem usa | Objetivo | Ações principais | Dados prioritários |
|---|---|---|---|---|
| `/admin` | Administrador autorizado | Selecionar e administrar lojas | Abrir loja, consultar usuários e configurações globais | Lojas, usuários, saúde e permissões |
| Visão da loja | Administrador da loja | Monitorar e operar o negócio | Abrir pagamentos, aplicações, produtos, cupons, carrinhos, extratos e releases | Pagamentos pendentes, aplicações, catálogo, caixa e atividade |
| Produtos e releases | Administrador da loja | Gerenciar catálogo e versões | Criar/editar produtos, publicar releases e disponibilizar ZIP | Produto, plano, release, versão, arquivos e atualização |
| Pagamentos | Administrador da loja | Aprovar ou rejeitar pagamentos pendentes | Aprovar, rejeitar e decidir sobre adição de saldo quando aplicável | Tipo, comprador, produto, valor, PIX, expiração e ação |
| Configurações administrativas | Administrador autorizado | Configurar CamposCloud, pagamentos e identidade do bot | Salvar credenciais/configurações e identidade | Estado da configuração, validação e segurança |

## 4. Dependências e lógica que devem ser preservadas

A auditoria identificou os seguintes contratos que não devem ser modificados durante a reforma:

1. **Autenticação:** NextAuth, login via Discord, fluxo de código de e-mail e redirecionamento por `callbackUrl`.
2. **Autorização:** verificações de sessão, proprietário da aplicação, acesso administrativo e seleção de loja.
3. **Pagamentos:** geração e acompanhamento de PIX, pagamentos manuais, EFI, PromissePay e respectivos webhooks.
4. **Persistência:** chamadas existentes às server actions, modelos, consultas e atualizações de estado.
5. **Aplicações:** iniciar, pausar, reiniciar, renovar, expirar, atualizar release e excluir conforme as regras já implementadas.
6. **Configuração:** módulos de loja, proteção, nuvem, automações e autenticação ZUROS.
7. **Telemetria:** status administrativo, atividade via SSE e telemetria enviada pelo bot.
8. **Integrações:** CamposCloud, Discord, provedores de pagamento, e-mail transacional e APIs de integração/client-bot.
9. **Mensagens de domínio:** textos de sucesso, erro e estado devem representar a mesma operação já executada, sem prometer ações que o backend não realiza.

A implementação segura deverá limitar mudanças funcionais a componentes de apresentação, composição, estilos, labels, feedback visual e organização de navegação. Cada botão reformulado deve continuar chamando o mesmo handler com os mesmos argumentos.

## 5. Diagnóstico visual e de UX

### 5.1 Pontos fortes

O frontend já possui uma camada de primitivas em `site/components/ui.tsx`, incluindo `Button`, `Card`, `Badge`, `Stat`, `Skeleton`, `Empty`, `Field`, `Modal`, `ConfirmDialog` e componentes de status. Também existem componentes específicos para dashboard, vendas, pagamentos, administração, configuração e autenticação.

A sidebar já distingue contextos de dashboard, administração e conta, possui modo compacto e apresenta o bot selecionado. O dashboard de vendas já apresenta indicadores, gráfico, atividade recente e blocos de operação. O login já contempla Discord, e-mail, confirmação por código, estados de carregamento e mensagens de erro.

A base também apresenta sinais positivos de acessibilidade: foram encontrados 117 usos de atributos `aria-*`, formulários em 13 arquivos e uso de componentes de imagem em 12 ocorrências.

### 5.2 Problemas estruturais

**Fragmentação visual.** O CSS global contém 3.444 linhas e combina tokens, classes utilitárias, estilos de landing page, login, dashboard, administração e módulos antigos. Isso dificulta garantir consistência de espaçamento, cor, foco, borda e estados.

**Excesso de arredondamento.** Existem muitos usos de `rounded-xl`, `rounded-2xl` e `rounded-lg` em cards, tabelas, botões e sidebar. O resultado se afasta do aspecto mais profissional e utilitário de Stripe, GitHub e Linear. A nova direção deve reservar raios maiores para superfícies de destaque e usar cantos menores em navegação, tabelas e controles.

**Hierarquia operacional insuficiente.** O dashboard atual é apresentado principalmente como “Minhas aplicações”. Ele lista aplicações e ações rápidas, mas não funciona plenamente como painel executivo consolidado. Dados já disponíveis em vendas, atividade, extratos e telemetria ainda estão distribuídos por áreas.

**Navegação com contextos sobrepostos.** A sidebar alterna entre Apps, Admin e Conta e também expõe ações relacionadas ao bot. A organização atual é funcional, mas pode exigir leitura e memória do usuário para entender a diferença entre operações da conta, da aplicação, da loja e da administração.

**Estados vazios inconsistentes.** Existem mensagens específicas em algumas áreas, como “Nenhuma aplicação” e “Nenhum pagamento pendente”, mas outras usam estados genéricos, silenciosos ou dependentes de componentes diferentes. A próxima versão precisa definir estado vazio por contexto e próximo passo permitido.

**Ações com rótulos curtos demais.** Foram encontrados rótulos como “Iniciar”, “Reiniciar”, “Parar”, “Editar” e “Abrir”. Eles podem ser adequados em contexto local, mas precisam de descrição complementar, tooltip, aria-label contextual e confirmação explícita quando a ação muda o estado da aplicação.

**Notificações ainda não são uma central completa.** Existe uma rota de conta para notificações e existem toasts e avisos de atividade, porém não foi identificada uma central unificada com categorias operacionais completas de vendas, pagamentos, aplicações, atualizações e sistema.

**E-mails básicos e heterogêneos.** O backend possui e-mails transacionais para carrinho, pagamento confirmado, renovação e release. Os fallbacks atuais usam HTML inline simples, com títulos e parágrafos, sem um sistema visual premium unificado de logo, CTA, rodapé, links úteis e responsividade consistente. Como o backend não pode ser alterado nesta etapa, a criação de templates deve ser tratada como uma camada de apresentação versionada e compatível com o mecanismo atual de envio.

**Dados demonstrativos na experiência de login.** O componente de login possui uma área visual com indicadores e atividade de demonstração. Esses números precisam ser claramente tratados como preview visual ou substituídos por dados reais já disponíveis, sem sugerir métricas da conta antes da autenticação.

## 6. Novo design system proposto

### 6.1 Princípios

O sistema visual deve priorizar densidade informacional controlada, leitura rápida, estados claros, foco em ações e consistência entre operação de cliente e administração. A estética deve ser escura, sóbria e técnica, com acento verde para sucesso/operação e cores semânticas discretas para informação, alerta e erro.

### 6.2 Tokens recomendados

| Token | Direção |
|---|---|
| Background | Fundo escuro sólido, sem depender de gradientes decorativos para estabelecer hierarquia. |
| Surface | Superfícies em dois níveis: painel e painel elevado. |
| Border | Bordas neutras de baixo contraste; borda forte apenas em foco, seleção e separação importante. |
| Text | Texto primário de alto contraste, secundário informativo e terciário auxiliar. |
| Accent | Verde ZUROS para ações positivas e estado saudável. |
| Info | Azul para informação e estado conectado. |
| Warning | Âmbar para atenção, expiração próxima ou ação pendente. |
| Danger | Vermelho para falha, parada e rejeição. |
| Radius | `4px` para controles, `6px` para cards operacionais, `8px` para superfícies especiais; evitar arredondamento indiscriminado. |
| Spacing | Escala de 4px com grupos de 8px, 12px, 16px, 24px e 32px. |
| Shadow | Sombra mínima; elevação deve vir principalmente de contraste de superfície e borda. |
| Motion | Transições curtas e discretas; respeitar `prefers-reduced-motion`. |

### 6.3 Componentes a consolidar

1. `AppShell` para estrutura de conteúdo, breadcrumb, título, descrição e ações primárias.
2. `Sidebar` com grupos explícitos: Visão geral, Operação, Vendas, Configuração, Conta e Administração.
3. `PageHeader` com contexto, título, descrição, ações e status.
4. `MetricCard` para valor, comparação, período e estado.
5. `StatusBadge` com vocabulário de domínio padronizado.
6. `DataTable` responsiva com coluna prioritária, filtros e estado vazio.
7. `ActionBar` com ação primária e ações secundárias.
8. `EmptyState` contextual com explicação e próximo passo.
9. `FeedbackBanner` para sucesso, erro, aviso e informação persistentes.
10. `NotificationCenter` com filtros, contagem, leitura e deep links existentes.
11. `ConfirmDialog` com verbo específico, consequência e estado de processamento.
12. `FormSection` e `Field` com ajuda, erro por campo e resumo de validação.
13. `Timeline` para atividade, releases, pagamentos e histórico.
14. `ResponsiveTable` que vira lista de registros em telas estreitas.
15. `Skeleton` por composição, em vez de blocos genéricos.

## 7. Layout e sidebar propostos

A sidebar deve manter fundo sólido, largura fixa no desktop e drawer no mobile. O item ativo deve usar uma faixa lateral ou fundo de seleção discreto, não apenas alteração de cor. Cada grupo deve ter título curto e separação visual suficiente.

Estrutura recomendada para cliente:

- **Visão geral:** Dashboard, Notificações.
- **Operação:** Aplicações, Servidores.
- **Vendas:** Visão geral, Pedidos, Produtos, Carrinhos abertos, Clientes, Pagamentos.
- **Financeiro:** Faturas, Extrato.
- **Configuração:** Configuração da aplicação, Autenticação.
- **Conta:** Perfil, Afiliados.

Estrutura recomendada para administração:

- **Administração:** Visão geral, Usuários.
- **Loja selecionada:** Aplicações, Produtos, Cupons, Carrinhos, Pagamentos, Extrato, Releases.
- **Plataforma:** Configurações globais, Telemetria, Sharpify.

No mobile, o menu deve informar o contexto atual no topo do drawer. O fechamento deve ocorrer ao navegar, pressionar Escape ou selecionar um item. O botão de menu deve ter nome acessível e estado `aria-expanded`.

## 8. Dashboard executivo proposto

O dashboard de entrada deve preservar a lista e as ações atuais, mas reorganizar a leitura em quatro níveis:

1. **Resumo executivo:** aplicações ativas, aplicações com atenção, vendas recentes e pagamentos pendentes, usando apenas dados que já existam nas consultas atuais.
2. **Operação:** lista de aplicações com status, validade, versão e ação primária contextual.
3. **Atividade recente:** eventos de venda, pagamento, atualização e operação já disponíveis no sistema.
4. **Atenções:** renovação próxima, pagamento pendente, aplicação offline, release disponível ou falha reportada.

Quando um dado não estiver disponível na consulta existente, a interface deve omitir o cartão ou apresentar “Não disponível”, nunca inventar valor. O dashboard de vendas permanece como visão específica da loja/aplicação e deve ser ligado ao resumo por links claros.

## 9. Sistema de notificações proposto

A central deve reutilizar eventos e dados já existentes, sem criar novas regras de geração no backend nesta fase. Categorias visuais:

| Categoria | Exemplos de conteúdo | Ação de destino |
|---|---|---|
| Vendas | Novo pedido, pedido entregue, carrinho expirando | Pedidos ou carrinho |
| Pagamentos | PIX gerado, pagamento confirmado, pagamento pendente | Checkout, faturas ou pagamentos administrativos |
| Aplicações | Aplicação iniciada, parada, expiração próxima | Detalhes da aplicação |
| Atualizações | Nova release ou atualização disponível | Release/configuração |
| Sistema | Indisponibilidade, telemetria, falha ou aviso de configuração | Status, configuração ou suporte |

Cada item deve conter categoria, título específico, descrição curta, data, estado lido/não lido e destino. O estado vazio deve dizer: “Você está em dia. Quando houver uma venda, pagamento, atualização ou alerta da sua conta, ele aparecerá aqui.”

## 10. E-mails premium propostos

A camada visual de e-mail deve adotar um template-base compatível com clientes de e-mail: largura máxima aproximada de 600px, tabela de layout quando necessário, estilos inline essenciais, fallback textual, CTA com URL absoluta, logo com texto alternativo, rodapé, suporte, privacidade e preferência de comunicação quando suportada pelo sistema.

Templates prioritários:

1. **Carrinho criado:** “Seu carrinho está pronto para pagamento”, com produto, plano, valor, expiração e CTA “Abrir pagamento”.
2. **Pagamento confirmado:** “Pagamento aprovado”, com tipo de operação, produto, valor, aplicação, validade e CTA “Abrir painel”.
3. **Renovação próxima:** “Sua aplicação vence em X dias”, com vencimento e CTA “Renovar aplicação”.
4. **Nova release:** “Nova atualização disponível”, com produto, versão, notas e CTA “Ver atualização”.
5. **Código de login:** e-mail transacional de autenticação com código, validade, aviso de segurança e suporte.

A implementação deve preservar as funções de envio, destinatários, assuntos semânticos e tokens já suportados. Não deve alterar o mecanismo de transporte nem as regras que disparam os e-mails.

## 11. Melhorias por página e fluxo

| Fluxo | Melhoria de experiência | Regra de preservação |
|---|---|---|
| Entrada pública | Hero mais direto, catálogo com comparação, CTA primário único e prova de confiança objetiva | Manter links, catálogo e condição atual de compra. |
| Login | Dois métodos em abas ou sequência clara, foco automático, erro junto ao campo, timer de código e retorno explícito | Manter Discord, e-mail, código e `callbackUrl`. |
| Compra | Resumo persistente do pedido, preço final destacado, expiração visível e ação “Gerar PIX” inequívoca | Manter o mesmo carrinho, cálculo, provedor e webhook. |
| Renovação | Separar claramente compra de renovação, apresentar validade e consequência da expiração | Manter ação de renovação e regras de validade. |
| Operação de aplicação | Mostrar status, última atualização, validade e controles no mesmo contexto | Manter handlers de iniciar, pausar, reiniciar e configurar. |
| Configuração | Navegação lateral por módulos, resumo de alterações e feedback por seção | Manter campos, server actions, validações e persistência. |
| Vendas | Tabs com contagens, filtros persistentes e tabelas responsivas | Manter queries e dados já retornados. |
| Administração | Separar monitoramento, operações financeiras, catálogo e releases | Manter permissões, aprovação/rejeição e integrações. |
| Notificações | Central categorizada e links profundos | Reutilizar eventos existentes; não criar regra de negócio nova. |
| E-mails | Template-base premium responsivo e tokens documentados | Manter envio e contratos existentes. |

## 12. Plano completo de implementação

### Fase 0 — Preparação e proteção

Criar uma matriz de contratos UI→ação contendo rota, componente, handler, parâmetros e resultado esperado. Congelar a lista de APIs, actions, webhooks e integrações. Adicionar testes de fumaça para login, dashboard, checkout, controle de aplicação, pagamento administrativo e configuração antes do redesign.

### Fase 1 — Fundação visual

Consolidar tokens de cor, espaçamento, tipografia, raio, borda, foco e movimento. Atualizar primitivas em `ui.tsx`. Criar `PageHeader`, `EmptyState`, `FeedbackBanner`, `MetricCard`, `ActionBar` e tabela responsiva sem alterar contratos de dados.

### Fase 2 — Shell e navegação

Reestruturar `DashboardShell`, `Sidebar`, `BotsNav` e navegação administrativa. Implementar grupos, contexto ativo, mobile drawer, teclado, foco e breadcrumbs. Validar todos os destinos atuais.

### Fase 3 — Dashboard e operação

Recompor o dashboard executivo e a visão de detalhes da aplicação. Reutilizar dados já carregados. Separar resumo, operação, atividade e atenção. Melhorar skeletons, erros e estados vazios.

### Fase 4 — Vendas e checkout

Revisar visão geral, pedidos, produtos, carrinhos, clientes, pagamentos, faturas e checkout. Aplicar linguagem de ação específica, resumo de pedido e feedback de pagamento. Não tocar em cálculo, geração de PIX, confirmação ou entrega.

### Fase 5 — Configurações e autenticação

Reorganizar os módulos de configuração e a área ZUROS Auth por tarefas. Melhorar agrupamento, ajuda contextual, validação visual, confirmação de salvamento e recuperação de erro. Preservar todos os campos e ações.

### Fase 6 — Administração

Criar layout operacional para loja, produtos, releases, cupons, pagamentos, carrinhos, extratos e telemetria. Destacar pendências e ações de aprovação/rejeição sem alterar permissões.

### Fase 7 — Notificações e e-mails

Implementar a central visual de notificações a partir dos dados/eventos existentes. Criar os templates HTML responsivos e versionados com compatibilidade de tokens e fallback textual.

### Fase 8 — Qualidade e rollout

Executar testes funcionais, responsivos e de acessibilidade. Comparar screenshots antes/depois por rota. Validar navegação por teclado, foco, contraste, `aria-*`, redução de movimento e comportamento em larguras móveis. Publicar em pequenos lotes por área, com rollback por commit.

## 13. Critérios de aceite

A reforma será considerada concluída quando:

- Nenhum endpoint, server action, webhook, modelo, integração, permissão ou regra de negócio tiver sido alterado.
- Cada rota existente continuar acessível sob os mesmos caminhos.
- Cada ação continuar chamando o mesmo contrato de dados.
- O dashboard exibir apenas dados reais já disponíveis.
- Os botões identificarem a ação com verbos específicos e contexto suficiente.
- Todos os estados de carregamento, erro, vazio, sucesso e confirmação forem definidos por área.
- A sidebar funcionar em desktop, tablet e mobile sem perder o contexto do usuário.
- A central de notificações diferenciar vendas, pagamentos, aplicações, atualizações e sistema.
- Os e-mails possuírem logo, CTA, conteúdo transacional, rodapé, links úteis e versão textual.
- O fluxo completo de login, compra, PIX, renovação, operação, configuração e administração passar pelos testes de fumaça.

## 14. Validação executada nesta auditoria

A análise foi somente leitura em relação às telas e à lógica. O repositório foi clonado sem mudanças funcionais. Foi feita a inspeção de rotas, layouts, componentes, estilos, server actions, API routes, autenticação, checkout, vendas, administração, notificações e e-mails.

A tentativa de validação automatizada falhou antes de concluir por dependências ausentes no ambiente, incluindo módulos como `zod`, `adm-zip`, `semver` e integrações relacionadas. O TypeScript reportou 48 erros em 14 arquivos de integração/configuração. Isso é uma limitação do ambiente de auditoria e não foi tratado alterando código, dependências ou backend. Antes da implementação visual, deve-se restaurar a instalação completa de dependências e repetir `typecheck`, `lint`, testes e build.

## 15. Próxima etapa recomendada

A próxima etapa segura é implementar a **Fase 0 e a Fase 1 em um branch separado**, começando pela matriz de contratos e pelas primitivas visuais. Não é recomendável alterar todas as páginas de uma vez. A sequência por fundação, shell, dashboard, vendas/checkout, configurações, administração e comunicações reduz risco e permite comprovar a preservação da lógica a cada etapa.

## Referências

[1]: https://nextjs.org/docs "Next.js Documentation"
[2]: https://www.w3.org/WAI/standards-guidelines/wcag/ "Web Content Accessibility Guidelines"
[3]: https://developer.mozilla.org/en-US/docs/Web/Accessibility "MDN Accessibility"
