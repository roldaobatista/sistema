# Sugestões de Melhorias – Módulo CRM

Documento gerado a partir da análise do código (backend, frontend, rotas e integrações). Foco em MVP completo, consistência de dados, UX e evolução sustentável.

---

## 1. Dashboard e KPIs

### 1.1 Filtro de período no dashboard
- **Problema:** KPIs (ganhos/perdidos no mês, receita ganha, mensagens) são sempre “mês atual”; não há comparação com período anterior ou escolha de intervalo.
- **Sugestão:** Adicionar no backend `CrmController::dashboard()` parâmetros opcionais `date_from` e `date_to` (ou `period`: `month`|`quarter`|`year`). No frontend, selector de período (este mês, último mês, trimestre, ano) e, se possível, exibir variação % vs período anterior.
- **Impacto:** Permite análise temporal e metas por período sem mudar estrutura de dados.

### 1.2 Exportação do dashboard
- **Problema:** Não há exportação (PDF/Excel) do resumo do dashboard para reuniões ou auditoria.
- **Sugestão:** Endpoint `GET /crm/dashboard/export?format=pdf|excel` (respeitando `reports.crm_report.view` ou `crm.deal.view`) e botão “Exportar” no `CrmDashboardPage`.
- **Consistência:** Alinhar ao padrão já usado em outros relatórios (ex.: `ReportController`, export 360).

### 1.3 Links diretos dos KPIs
- **Sugestão:** “Deals abertos” → lista de deals com filtro status=open; “Sem contato > 90d” → lista de clientes (ou tela “Clientes esquecidos”); “Calibrações vencendo” → equipamentos ou Customer 360. Melhora descoberta e ação a partir do dashboard.

---

## 2. Pipeline e Deals

### 2.1 Filtros e busca na lista de deals
- **Problema:** `dealsIndex` já aceita `pipeline_id`, `status`, `assigned_to`, `customer_id`; no frontend do Pipeline (kanban) o filtro é basicamente por status (open). Lista “todos os deals” em tabela com filtros avançados não está evidente no fluxo.
- **Sugestão:** Na página de Pipeline ou em uma view “Lista de deals”:
  - Filtros por responsável, cliente, data de previsão de fechamento, valor (faixa).
  - Busca por título do deal ou nome do cliente.
- **Backend:** Já suporta; falta expor no UI e, se necessário, adicionar `search` (like em `title` ou em `customer.name`) e `expected_close_date_from`/`to`.

### 2.2 Motivo de perda estruturado
- **Problema:** `lost_reason` é texto livre; difícil análise de perdas (já existe `CrmLossReason` e módulo “Análise de perdas”).
- **Sugestão:** No `dealsMarkLost` e no drawer de deal:
  - Permitir escolher um motivo cadastrado (tabela `crm_loss_reasons` ou equivalente) + campo opcional “Observação”.
  - Garantir que a tela “Análise de perdas” use esse motivo para gráficos e filtros.

### 2.3 Duplicação de deal
- **Sugestão:** Ação “Duplicar deal” (mesmo cliente, novo título, mesmo pipeline/estágio inicial, sem vínculos de quote/OS) para reabrir negócios similares sem retrabalho.

### 2.4 Atualização em tempo real (opcional)
- **Sugestão:** Para ambientes com vários usuários no mesmo pipeline, considerar WebSockets (Reverb já existe) ou polling para atualizar kanban quando outro usuário move/edita deal, evitando conflitos de percepção.

---

## 3. Atividades e Calendário

### 3.1 Filtro por responsável nas atividades
- **Problema:** `activitiesIndex` não filtra por `user_id`; quem “só vê os próprios” depende do `ScopesByRole` em deals, não necessariamente em atividades.
- **Sugestão:** Aceitar `user_id` e, se a role for “vendedor”, aplicar scope automático “só minhas atividades” (consistente com deals).

### 3.2 Integração calendário ↔ atividades
- **Sugestão:** Garantir que a página “Calendário” (`CrmCalendarPage`) use as atividades com `scheduled_at` e, se houver eventos em `crm_calendar_events`, unificar em uma única vista. Criar atividade a partir do calendário e vice-versa (evento → atividade) evita duplicação de informação.

### 3.3 Lembretes de follow-up
- **Sugestão:** “Próximos passos” e “data de próximo contato” já existem em visit reports; notificações (in-app ou e-mail) para o responsável quando a data de follow-up chega, usando fila (jobs) para não bloquear request.

---

## 4. Customer 360 e Cliente

### 4.1 Navegação Cliente → CRM
- **Sugestão:** No Customer 360 e na listagem de clientes, links claros para: “Deals deste cliente”, “Atividades”, “Oportunidades latentes” (quando aplicável). No deal/cliente, breadcrumb ou link “Ver Customer 360” para fechar o ciclo.

### 4.2 Health score e “sem contato”
- **Sugestão:** Manter `last_contact_at` e `health_score` sempre que houver atividade CRM (ligação, e-mail, visita, deal ganho/perdido). Revisar observers/services para que nenhuma interação relevante deixe de atualizar esses campos.

### 4.3 Oportunidades latentes → deal
- **Problema:** Em “Oportunidades” o usuário pode ir para o cliente, mas não “criar deal a partir desta oportunidade” em um clique.
- **Sugestão:** Botão “Criar deal” na linha da oportunidade (pré-preenchendo cliente, pipeline padrão e título sugerido pelo tipo de oportunidade), abrindo o modal de novo deal.

---

## 5. Mensagens e Templates

### 5.1 Status de entrega e retries
- **Problema:** Dashboard já mostra `delivery_rate` e `failed`; não está claro se há retentativas automáticas para mensagens falhas.
- **Sugestão:** Documentar comportamento (ou implementar) de retry para status `failed` (ex.: 2 retentativas com backoff) e, no frontend, exibir na lista de mensagens o status (enviado/entregue/lido/falha) e opção “Reenviar” quando falha.

### 5.2 Templates e variáveis
- **Sugestão:** Se ainda não existir, suportar variáveis em templates (ex.: `{{cliente_nome}}`, `{{valor_orcamento}}`) substituídas no envio, e lista de variáveis disponíveis no editor de template.

---

## 6. Permissões e Segurança

### 6.1 Consistência de permissões
- **Problema:** Duas rotas para Customer 360: `reports.crm_report.view` (legado) e `crm.deal.view` no grupo `/crm`. Duplicidade pode confundir e causar acesso indevido.
- **Sugestão:** Unificar sob uma única permissão (ex.: `crm.deal.view` ou `reports.crm_report.view`) e uma única rota para 360 e export PDF, documentando no PermissionsSeeder.

### 6.2 Escopo “só meus deals”
- **Sugestão:** Garantir que `ScopesByRole` esteja aplicado de forma consistente em: deals, atividades, alertas, metas (quando por usuário). Revisar todas as queries CRM que listam por usuário para usar o mesmo critério de “vendedor vê só o seu”.

---

## 7. Performance e Dados

### 7.1 Paginação e limites
- **Problema:** No frontend, pipeline pode carregar `per_page: 200` deals; em carteiras grandes isso pode ficar pesado.
- **Sugestão:** Paginação por estágio ou “carregar mais” por coluna; ou limite máximo (ex.: 100) com aviso “Há mais deals; use filtros”.

### 7.2 Índices no banco
- **Sugestão:** Índices compostos para consultas comuns, por exemplo: `(tenant_id, status, updated_at)` em `crm_deals`; `(tenant_id, customer_id, scheduled_at)` em `crm_activities`. Respeitar regra de nomes de índice < 64 caracteres (migration-safety).

### 7.3 Cache de constantes
- **Problema:** `constants` (status, fontes, tipos de atividade, etc.) são carregados em toda tela que precisa.
- **Sugestão:** Cache no backend (ex.: 1h) para `GET /crm/constants` e no frontend usar React Query com staleTime alto ou contexto global, reduzindo chamadas repetidas.

---

## 8. UX e Navegação

### 8.1 Menu CRM
- **Problema:** Muitos itens no submenu CRM (mais de 30); fica difícil encontrar funções.
- **Sugestão:** Agrupar em subgrupos colapsáveis no menu (ex.: “Pipeline e Deals”, “Campo e Visitas”, “Análises”, “Configurações”) ou uma “home” CRM com cards por área (Dashboard, Pipeline, Alertas, Metas, etc.) que levam às telas.

### 8.2 Empty states e onboarding
- **Sugestão:** Em pipeline vazio, “Criar primeiro deal” com passo a passo; em “Alertas” vazio, mensagem clara “Nenhum alerta no momento” e link para configuração de regras (se houver). Mesmo padrão em outras listas vazias do CRM.

### 8.3 Feedback de ações
- **Sugestão:** Todas as mutações (criar/editar deal, mover estágio, marcar ganho/perda, criar atividade) já com toast de sucesso; garantir que erros da API sejam mapeados para mensagens em português (ex.: “Não é possível excluir pipeline com deals vinculados”).

---

## 9. Integração com Outros Módulos

### 9.1 Orçamento → Deal
- **Problema:** Deal pode ter `quote_id`; não está claro se ao aprovar orçamento o deal é automaticamente movido/ganho ou se há notificação.
- **Sugestão:** Listener ou job: quando orçamento for aprovado, atualizar deal vinculado (ex.: mover para “Proposta aceita” ou marcar como ganho) e registrar atividade “Orçamento aprovado”.

### 9.2 OS → Deal
- **Problema:** `work_order_id` no deal; quando a OS é faturada/fechada, pode fazer sentido marcar deal como ganho ou registrar atividade.
- **Sugestão:** Regra clara (listener): ao faturar OS vinculada a deal, opção de marcar deal como ganho e preencher valor realizado pela OS.

### 9.3 Equipamento / Calibração
- **Problema:** Calibrações vencendo já aparecem no dashboard; oportunidade “calibração vencendo” em Oportunidades latentes.
- **Sugestão:** Botão “Criar deal” a partir do alerta de calibração (pré-preenchendo cliente e equipamento) e link do deal para o equipamento para rastreabilidade.

---

## 10. Qualidade e Regressão

### 10.1 Testes
- **Sugestão:** Testes de feature cobrindo: dashboard (estrutura da resposta e escopo por tenant); criação e movimento de deal; marcar ganho/perda; permissões (sem permissão retorna 403). Manter e estender `CrmTest`, `CrmExtendedTest`, `CrmProfessionalTest`, `CrmMessagingTest` conforme novas regras.

### 10.2 Validação e consistência
- **Sugestão:** Ao mover deal para estágio “ganho”/“perdido”, validar que o estágio tem `is_won`/`is_lost`; evitar que um estágio intermediário marque como ganho. No backend, `dealsMarkWon`/`dealsMarkLost` já podem checar o estágio atual antes de aplicar.

---

## Priorização sugerida (MVP primeiro)

| Prioridade | Item |
|------------|------|
| Alta       | Filtro de período no dashboard (1.1); Links dos KPIs (1.3); Motivo de perda estruturado (2.2); Oportunidade → criar deal (4.3); Unificar permissões 360 (6.1) |
| Média      | Exportação dashboard (1.2); Filtros/busca deals (2.1); Duplicar deal (2.3); Atividades por responsável (3.1); Integração orçamento/OS com deal (9.1, 9.2); Índices e cache constants (7.2, 7.3) |
| Baixa      | Subgrupos no menu CRM (8.1); Retry mensagens (5.1); Variáveis em templates (5.2); WebSockets no pipeline (2.4) |

---

*Documento alinhado às regras do projeto: clean-code, mvp-completeness, error-resilience, data-consistency-guard, permission-completeness, migration-safety, ux-consistency.*
