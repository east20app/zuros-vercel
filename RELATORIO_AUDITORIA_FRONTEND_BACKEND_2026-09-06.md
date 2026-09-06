# Relatório de Auditoria do ZUROS

**Data:** 6 de setembro de 2026  
**Escopo:** frontend público, dashboard, navegação do DROX, status das aplicações, integração com bots e backend  
**Referência visual:** exemplo de dashboard enviado em `Pasted_content_16.txt`  
**Resultado:** auditoria somente leitura; nenhum arquivo foi alterado nesta etapa.

## 1. Conclusão executiva

O projeto possui uma base funcional relevante, mas os problemas observados não são apenas visuais. O frontend público e o dashboard podem falhar antes de renderizar qualquer interface quando as variáveis de ambiente do MongoDB não estão disponíveis. O status mostrado ao usuário mistura estado de licença, estado da hospedagem e presença real do bot. A telemetria e parte do controle de integração dependem de estado em memória ou de credenciais globais, o que é frágil em ambientes serverless e merece correção antes de uma grande reformulação visual.

A recomendação é trabalhar em quatro fases. A primeira deve restaurar a confiabilidade de carregamento e eliminar informações de status falsas. A segunda deve corrigir autenticação, telemetria, tokens e operações externas. A terceira deve estabelecer um sistema visual único para home, planos, dúvidas, rodapé e dashboard. A quarta deve refatorar as páginas dos bots, reduzir densidade, corrigir navegação e validar tudo em viewports reais.

> A referência enviada deve orientar hierarquia, densidade, navegação e clareza da interface. Ela não deve ser copiada visualmente. A identidade da ZUROS precisa manter sua própria paleta, marca e linguagem.

## 2. Estado de publicação da atualização anterior

A atualização de tema foi publicada no GitHub no commit [`f73e008`](https://github.com/east20app/zuros-vercel/commit/f73e008), no branch `main`. Este relatório não inclui novas alterações de código.

## 3. Achados críticos

| Prioridade | Área | Achado | Impacto |
|---|---|---|---|
| P0 | Runtime | Home, planos, sobre, status e dashboard importam configuração de banco/autenticação obrigatória e podem retornar HTTP 500 antes da UI | Site indisponível ou com erro bruto |
| P0 | Segurança | A bridge aceita credencial global e identidade fornecida pelo chamador em partes do fluxo | Possível representação de outro proprietário |
| P0 | Segurança | Tokens Discord são armazenados em texto simples e há credencial Mongo sensível em `.env.example` | Comprometimento de bots e banco em caso de vazamento |
| P0 | Status | A página pública de status exibe “Operacional” sem health check real | Informação falsa para usuários |
| P1 | Status | `application.status`, status da CamposCloud e presença real do Discord não são consolidados | Dashboard pode exibir estados contraditórios |
| P1 | Operação | Telemetria usa memória do processo e não tem `lastSeen` durável | Dados desaparecem em cold start ou entre instâncias |
| P1 | UX | Cards de aplicações e barras de módulos têm densidade e tamanho excessivos, especialmente em telas estreitas | Dashboard difícil de escanear e usar |
| P1 | UX | Troca de período em vendas pode manter dados antigos sem informar erro | Usuário vê dados de um período diferente do selecionado |
| P1 | UX | Link de controles da Sidebar pode alterar a URL sem alterar a aba ativa | Navegação aparentemente quebrada |
| P2 | Frontend | Classes inválidas em AutomationsEditor impedem estilos esperados | Trechos visuais inconsistentes |
| P2 | Público | Navbar mobile perde links principais abaixo de determinados breakpoints | Navegação incompleta |
| P2 | Público | FAQ não possui rota canônica própria e o rodapé tem destinos inconsistentes | SEO e descoberta prejudicados |

## 4. Frontend público

A home apresenta dados sintéticos de pagamentos e gráfico sem rotulá-los claramente como demonstração. A linguagem pode ser interpretada como telemetria real. O conteúdo deve ser substituído por dados reais anonimizados ou identificado como “Exemplo de interface”.

A página de status é estática. Ela apresenta plataforma, bots, aplicações e pagamentos como operacionais sem consultar banco, CamposCloud, dependências ou eventos recentes. O rodapé repete uma afirmação operacional incondicional. O resultado esperado deve conter estados como `Operacional`, `Degradado`, `Indisponível` e `Desconhecido`, além de horário da última verificação e fonte do dado.

A navbar pública não oferece menu mobile completo. Em telas estreitas, os links para Início, Planos, Sobre e Status deixam de estar acessíveis diretamente. A correção deve incluir botão acessível, drawer, foco, tecla Escape e fechamento ao navegar.

A área de dúvidas existe apenas como bloco dentro da home. Deve ser criada uma rota canônica, preferencialmente `/duvidas` ou `/faq`, com conteúdo sobre planos, cobrança, cancelamento, exclusão de dados, configuração, suporte e disponibilidade. O sitemap deve incluir a nova rota, além de Sobre e Status.

O texto da interface mistura português e inglês sem uma regra clara. Expressões como “Control room for communities”, “setup”, “dashboard” e “Em preparação” devem ser revisadas. O texto “Próximo passo, a operação começa quando você execa” deve ser substituído por uma frase clara, por exemplo: “Próximo passo: execute a configuração e coloque sua operação em funcionamento.”

## 5. Dashboard e páginas dos bots

A lista de aplicações deve ser mais compacta. O card atual pode ser reduzido para mostrar nome, tipo, status real, validade, plano e uma única ação principal. Informações secundárias devem aparecer na página de detalhes, não em todos os cards.

A Sidebar apresenta redundância entre “Minhas aplicações” e “Trocar aplicação”, ambos levando ao dashboard. Os destinos devem ser diferenciados ou um dos itens deve ser removido. A barra `UserBotWorkspaceBar` reúne muitos módulos em uma única faixa horizontal; ela precisa de agrupamento por categorias, rolagem controlada, estado ativo evidente e versão responsiva.

A área de configuração deve manter uma navegação previsível entre Visão geral, Vendas, Loja, Tickets, Personalização, Automações, Cloud, Mensagens, Proteção, Sorteios, Configurações e Extensões. Cada tela deve compartilhar o mesmo cabeçalho, breadcrumb, estado de carregamento, estado vazio, estado de erro e ação de retorno.

A troca de aba via `?tab=controles` pode atualizar a URL sem atualizar o estado controlado de `AppTabs`. O comportamento precisa ser sincronizado com `useSearchParams` ou convertido para navegação com estado único.

O `SalesDashboard` altera visualmente o período antes de concluir o fetch. Quando ocorre falha, mantém os dados anteriores sem indicar que são do período antigo. O componente deve mostrar carregamento por período, erro contextual, botão de tentar novamente e uma regra explícita para preservar ou reverter o filtro.

O `AutomationsEditor` contém classes inválidas como `upperlase`, `tralking-wider`, `tralking-widest`, `text-[#b5bal1]` e `hover:bg-[#35373l]`. Essas classes devem ser corrigidas e o restante dos estilos arbitrários deve passar por uma busca automatizada.

Tabelas de clientes e carrinhos usam larguras mínimas grandes. Em dispositivos móveis, devem ser substituídas por cartões responsivos ou receber uma versão resumida antes da tabela horizontal completa.

## 6. Backend, status e integração com bots

O backend possui boa separação geral entre Server Actions, MongoDB, CamposCloud, Discord API e bot hospedado. As Server Actions normalmente validam sessão Discord e `ownerId`. A camada de configuração do DROX valida documentos e possui fallback de polling quando Change Streams não estão disponíveis.

O principal problema é a ausência de uma fonte única de verdade para o estado vivo da aplicação. Existem pelo menos três estados diferentes:

1. `application.status`, que representa licença ou ciclo de vida comercial.
2. `currentResourceMetrics.online`, que representa a leitura do provedor de hospedagem.
3. Presença real do bot no Discord Gateway.

Esses estados precisam ser mantidos separados e apresentados com nomes claros. A UI não deve chamar uma licença ativa de “bot online”.

A telemetria atual usa `globalThis`, `Map` e arrays limitados por processo. Em Vercel, isso não é compartilhado entre instâncias e pode desaparecer em cold starts. O heartbeat também registra atividade, mas não atualiza um `lastSeen` durável ligado à aplicação.

A solução recomendada é criar um registro durável de runtime por `applicationId`, contendo `lastSeen`, `providerState`, `processState`, `discordState`, `version`, `uptime`, `observedAt` e `failureReason`. O dashboard deve consumir um DTO único com estado, fonte, timestamp e idade do dado.

As operações de iniciar, parar, reiniciar, trocar token e trocar servidor podem deixar MongoDB e CamposCloud divergentes em caso de falha intermediária. Essas operações devem ser tratadas como jobs idempotentes, com estado transitório, confirmação posterior e compensação ou alerta quando houver falha.

A bridge não deve confiar em `discord_user_id` fornecido pelo consumidor. A identidade deve ser derivada de sessão ou credencial assinada vinculada à aplicação. A credencial global deve ser substituída por credenciais por bot/aplicação, com escopos, assinatura HMAC, nonce armazenado de forma compartilhada, expiração e rate limit distribuído.

Tokens Discord precisam ser criptografados em repouso. A credencial Mongo existente em `.env.example` deve ser revogada imediatamente se for real e substituída por placeholder. Nenhum token deve aparecer em logs, respostas ou arquivos temporários sem necessidade operacional.

## 7. Plano de implementação recomendado

| Fase | Objetivo | Principais entregas |
|---|---|---|
| 1 | Confiabilidade | Fallback público sem banco, error states, health checks reais, status com timestamp, correção dos crashes e rotas públicas |
| 2 | Segurança e consistência | Tokens criptografados, rotação de credenciais, bridge por aplicação, heartbeat durável, runtime DTO, jobs idempotentes |
| 3 | Sistema visual | Tokens centralizados, shell público, navbar mobile, planos, dúvidas, rodapé, loading/empty/error padrão |
| 4 | Dashboard | Cards compactos, Sidebar reorganizada, workspace bar categorizada, AppTabs sincronizada, páginas internas padronizadas |
| 5 | Validação | Testes de integração com Mongo/CamposCloud indisponíveis, testes mobile, testes de status stale, lint, typecheck e build |

## 8. Critérios de aceitação

A home, planos, sobre e status devem renderizar uma interface útil mesmo quando catálogo, banco ou telemetria estiverem indisponíveis. Nenhuma página pública deve mostrar “Operacional” sem uma verificação registrada. O dashboard deve diferenciar licença, hospedagem e presença do bot. Toda ação de ciclo de vida deve retornar estado confirmado ou estado transitório explícito.

A interface mobile deve permitir acessar todas as áreas essenciais. Os cards de aplicação devem ser compactos e legíveis. Todas as páginas de módulo devem compartilhar padrões de cabeçalho, navegação e estados. O projeto deve continuar passando em `typecheck`, `lint`, `test` e `build` após cada fase.

## Referências

[1]: https://github.com/east20app/zuros-vercel "Repositório GitHub do projeto ZUROS"

[2]: https://github.com/east20app/zuros-vercel/blob/main/DEPLOY_VERCEL.md "Instruções de deploy do ZUROS"

[3]: https://github.com/east20app/zuros-vercel/blob/main/docs/ANALISE-ZUROS.md "Análise arquitetural existente do ZUROS"

[4]: https://github.com/east20app/zuros-vercel/commit/f73e008 "Commit da atualização de temas"
