# Auditoria de paridade entre site e Discord — ZUROS

Data: 15/08/2026

## Resumo

O site utiliza os mesmos documentos do bot DROX e salva diretamente no banco usado pelo bot. A paridade de dados existe, mas a paridade visual e de fluxo ainda varia por módulo. Nenhuma tela deve exibir JSON; o JSON permanece apenas como formato interno de sincronização.

| Área | Dados do bot | Fluxo no site | Paridade | Trabalho necessário |
|---|---|---|---|---|
| Aplicações | `applications` + CamposCloud | Iniciar, parar, reiniciar, renovar, trocar nome/token/servidor | Alta | Manter mensagens e estados iguais ao Discord. |
| Loja | 11 documentos `loja_*` | Editor próprio `LojaEditor` | Alta | Refinar criação de painéis, cupons, estoque e seletor de emojis. |
| Produtos | `loja_products` | Editor próprio e página dedicada | Alta | Melhorar criação em etapas e prévia da mensagem. |
| Pagamentos | `payment_configs` + `pagamentos` | Editor próprio movido para `/vendas/pagamentos` | Alta | Publicar após renovar autenticação da Vercel; adicionar identidade visual de cada provedor. |
| Proteção | 15 documentos de proteção | `ProtectionDashboard` + `ProtectionEditor` | Alta | Igualar textos de confirmação e alertas do Discord. |
| Tickets | `tickets_config` | Formulário visual genérico | Média | Criar editor próprio de painéis, perguntas, equipe, botões, mensagens e transcripts. |
| Automações | 18 documentos `automations_*` | Seções visuais com campos dinâmicos | Média | Criar telas próprias por automação, ações de adicionar/remover e prévias. |
| Sorteios | `giveaways` | Formulário visual genérico | Média/baixa | Criar fluxo de criação, prêmio, canal, duração, participantes e ganhadores. |
| Personalização | `custom_*` | Formulários de cores, status e informações | Média | Adicionar seletor de atividade, prévia do perfil e editor de emojis. |
| Cargos e canais | `cargos` + `canais` | Seletores reais do Discord | Alta | Exibir ícones e agrupar categorias, texto e voz. |
| Emojis | Configurações textuais/customizadas | Campo de texto comum | Baixa | Criar seletor visual de emoji Unicode/customizado com prévia. |
| Blacklist e anti-fake | `blacklist` + `antifake_config` | Campos visuais | Média | Criar tabelas de usuários, busca, confirmação e ações equivalentes aos botões do Discord. |
| Vendas | Documentos `loja_buys`, `loja_data` e carrinhos | Visão geral, pedidos, clientes e carrinhos | Alta | Adicionar atualização explícita, filtros e detalhamento do pedido. |

## Problemas funcionais encontrados

1. Arrays complexos conseguem remover itens, mas o formulário genérico não oferece criação segura quando a lista começa vazia.
2. Tickets e sorteios não possuem fluxos guiados equivalentes aos modais e seletores do Discord.
3. Emojis personalizados aparecem como texto; falta seletor e prévia visual.
4. Algumas chaves técnicas são apenas transformadas em título, sem descrição amigável específica.
5. Prévia Discord existe, mas ainda é genérica para vários documentos e não representa cada tipo de mensagem.
6. A configuração de pagamentos foi corrigida localmente, mas o último deploy foi bloqueado por token Vercel inválido.

## Ordem recomendada

1. Tickets: maior quantidade de interações e maior diferença visual.
2. Sorteios: criação guiada e gerenciamento de participantes/ganhadores.
3. Automações: editores próprios para cada tipo.
4. Emojis: componente reutilizável em loja, tickets, sorteios e mensagens.
5. Personalização, blacklist e anti-fake.
6. Ajustes finais de textos, confirmações e prévias.

