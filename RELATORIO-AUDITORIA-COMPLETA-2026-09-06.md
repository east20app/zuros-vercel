# Relatório de Auditoria Completa — ZUROS APP

**Data:** 6 de setembro de 2026  
**Escopo:** frontend público, dashboard, módulos de configuração, backend, MongoDB, CamposCloud, pagamentos, autenticação, segurança e deploy.

## Conclusão executiva

A auditoria encontrou uma base funcional ampla, mas identificou problemas que explicam falhas visuais e erros genéricos de Server Components. A compilação está estável, porém a estabilidade de runtime depende fortemente de variáveis de ambiente, MongoDB, CamposCloud e documentos externos. O sistema também possui estados de saúde apresentados como operacionais sem uma verificação correspondente.

O risco mais grave é a exposição de credenciais. A auditoria encontrou tokens e credenciais armazenados em texto puro em modelos de aplicação e configurações de integração. Também encontrou uma credencial MongoDB no histórico do repositório. A senha do MongoDB deve ser revogada e substituída imediatamente.

A auditoria também confirmou que a Vercel consegue publicar um deployment mesmo quando o check de qualidade do GitHub falha. Isso permite que erros antigos ou regressões cheguem à produção. O deployment bem-sucedido não deve ser interpretado como validação funcional completa.

## Matriz de severidade

| Severidade | Área | Achado principal | Impacto |
|---|---|---|---|
| Crítica | Segredos | Credencial MongoDB exposta no histórico do Git | Acesso indevido ao banco caso ainda esteja válida |
| Alta | Dashboard | Layout global depende de várias consultas Mongo sem fallback | Erro transitório pode derrubar todo o painel |
| Alta | Segurança | Tokens de bot e credenciais de integração em texto puro | Comprometimento de bots, pagamentos e CamposCloud |
| Alta | Integração | Bridge global aceita identidade enviada pelo chamador | Escopo excessivo para operações de aplicações |
| Alta | Telemetria | Heartbeat protegido por segredo global e sem vínculo completo | Status falso ou aplicação incorreta atualizada |
| Alta | Pagamentos | Fluxos automáticos e manuais não compartilham a mesma máquina idempotente | Possível divergência entre saldo, carrinho e entrega |
| Alta | Deploy | Vercel não exige o check de qualidade antes de publicar | Código com CI falho pode chegar à produção |
| Média | Frontend | Estados fixos de operação aparecem como status real | Usuário pode interpretar saúde inexistente |
| Média | Mobile | Barra de módulos e tabelas exigem rolagem horizontal extensa | Operação difícil em telas pequenas |

## Auditoria página por página

### Páginas públicas

A home, planos, dúvidas, status, sobre e not-found importam direta ou indiretamente sessão, banco ou autenticação. Quando `MONGO_DB_URL` ou `DROX_BOTS_MONGO_URI` está ausente, o erro ocorre antes de uma renderização degradada. A home e os planos também executam consultas de catálogo sem fallback local.

A página de login não trata completamente falhas do `signIn`. Uma falha de rede ou OAuth pode deixar o botão em estado de carregamento sem uma mensagem acionável. A barra de anúncio possui classes diferentes das esperadas pelo CSS responsivo. A navbar não informa `aria-current` para leitores de tela.

### Dashboard e minhas aplicações

O layout do dashboard executa consultas de lojas, pendências e acesso administrativo em paralelo. Uma exceção em qualquer uma dessas consultas pode impedir a renderização das páginas descendentes. O tratamento de erro existente melhora a mensagem, mas não substitui um fallback de dados para indicadores auxiliares.

A visão geral exibe aplicações ativas e ausência de erro de atualização como se fossem saúde operacional. Isso não confirma presença Discord, heartbeat recente ou disponibilidade da hospedagem. A página de servidores exibe “presença sincronizada” sem demonstrar uma verificação equivalente.

### Vendas

Rendimento e clientes usam principalmente `loja_buys`. Renovações e registros de outras coleções podem não entrar nos totais. Carrinhos abertos usa uma fonte diferente e não inclui necessariamente todos os carrinhos de renovação.

A página de produtos promete edição de nomes, preços e duração, mas o formulário atual não oferece todos esses campos. Essa divergência precisa ser resolvida por implementação ou por ajuste de texto.

Pedidos, clientes e carrinhos possuem tabelas com larguras mínimas elevadas. Em dispositivos móveis, a rolagem horizontal reduz a visibilidade dos dados e das ações.

### Configurações dos bots

Os módulos de loja, tickets, personalização, automações, DROX Cloud, mensagens, proteção, sorteios, configurações e extensões usam um editor comum. O editor possui estados de carregamento e erro, mas falhas de autorização, bot offline, documento ausente e timeout aparecem de forma parecida.

O índice de configuração é exibido na página de detalhe, enquanto a rota `/dashboard/[appId]/config` redireciona diretamente para loja. Isso cria uma experiência inconsistente quando o usuário acessa a configuração pelo menu ou por URL direta.

### Backend e integrações

Os modelos de aplicações armazenam o token do bot sem criptografia em repouso. Configurações de CamposCloud, pagamentos e certificados também possuem caminhos que armazenam valores sensíveis sem proteção criptográfica suficiente. Base64 não é criptografia.

A bridge de integração usa uma credencial global e aceita `discord_user_id` enviado na requisição. A autorização depende integralmente da posse dessa credencial. O heartbeat não vincula de forma suficiente bot, aplicação, servidor e origem.

Webhooks usam segredos em query string em alguns provedores e não aplicam assinatura HMAC uniforme ao corpo. Falhas transitórias podem ser respondidas como sucesso, impedindo reenvio do provedor.

## Novo fluxo implementado: servidor opcional após a compra

O servidor principal passou a ser tratado como opcional na criação da aplicação. O pagamento e a entrega não devem ser bloqueados por ausência de servidor.

Após a aprovação, o cliente recebe o link de convite do bot. No dashboard, quando `serverId` estiver vazio, aparece o botão **Adicionar bot ao servidor**. O link usa somente o `botId`, escopo `bot` e `applications.commands`, com permissões inicialmente iguais a zero.

O servidor continua configurável posteriormente pela área de configurações. O token não é exibido no dashboard nem incluído no convite.

| Momento | Comportamento |
|---|---|
| Checkout | Nome e token são obrigatórios; servidor é opcional |
| Pagamento aprovado | Aplicação é criada mesmo sem servidor |
| Entrega | Ambiente da aplicação recebe `SERVER_ID` vazio quando não configurado |
| Pós-compra | Cliente recebe o convite OAuth2 do bot |
| Dashboard | Mostra “Servidor principal não configurado” e botão de convite |
| Configuração posterior | Cliente pode escolher o servidor principal depois |

## Prioridades recomendadas

A primeira prioridade é revogar a credencial MongoDB exposta, rotacionar tokens e migrar segredos para criptografia em repouso. A segunda prioridade é tornar o check de qualidade obrigatório antes do deploy. A terceira prioridade é colocar fallback no layout do dashboard e estados de erro específicos por página.

Depois disso, deve-se unificar as operações de pagamento em uma máquina idempotente, adicionar reconciliação e corrigir os webhooks para diferenciar erro transitório de payload inválido. Por fim, devem ser adicionados testes E2E com MongoDB, CamposCloud, Discord e provedores de pagamento simulados.

## Validações

As verificações estáticas disponíveis passaram no estado auditado: typecheck, lint, build do site e testes existentes. A auditoria não executou operações reais contra a conta Discord, MongoDB de produção, CamposCloud ou gateways de pagamento.

## Referências

[1]: https://github.com/east20app/zuros-vercel "Repositório GitHub do projeto ZUROS"
[2]: https://nextjs.org/docs/app/building-your-application/routing/error-handling "Next.js Error Handling"
[3]: https://discord.com/developers/docs/resources/user "Discord API — User and Bot Authorization"
