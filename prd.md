# Sistema OS — Product Requirements Document (PRD)

> Documento completo de requisitos do produto para orientação de testes automatizados (TestSprite).
> Gerado a partir da análise do código-fonte em 12/02/2026.

---

## 1. Visão Geral

O **Sistema OS** é um ERP completo para empresas de serviços técnicos (calibração de instrumentos, manutenção de equipamentos, metrologia). Ele gerencia todo o ciclo operacional: desde a captação do cliente (CRM), passando por orçamentos, ordens de serviço, gestão de técnicos em campo, financeiro, comissões, estoque, equipamentos, INMETRO, até relatórios gerenciais.

O sistema é **multi-tenant** (várias empresas no mesmo banco de dados, isoladas por `tenant_id`) e **multi-filial** (cada tenant pode ter N filiais/branches).

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| **Frontend** | React 18 + TypeScript + Vite | Porta de desenvolvimento: `3000` (configurada em vite.config.ts) |
| **Backend** | Laravel 11 (PHP 8.2+) | Porta: `8000` (`php artisan serve`) |
| **Banco de Dados** | SQLite (dev) / MySQL (produção) | Multi-tenant via coluna `tenant_id` |
| **Autenticação** | Laravel Sanctum (tokens SPA) | Tokens armazenados no `localStorage` |
| **Permissões** | Spatie Permission (RBAC) | 120+ permissões, 8 roles |
| **Estado Frontend** | Zustand + TanStack React Query | Cache de 30 segundos, retry=1 |
| **Estilização** | Tailwind CSS | Design system customizado |
| **Roteamento Frontend** | React Router v6 | Com guards de permissão por rota |

---

## 3. Autenticação e Autorização

### 3.1 Fluxo de Login (Administrativo)

1. Usuário navega para `/login`
2. Preenche **e-mail** e **senha**
3. Frontend faz `POST /api/v1/login` (throttle: 60 req/min)
4. Backend valida credenciais via Sanctum e retorna JWT/token + dados do usuário
5. Frontend armazena token no `localStorage` via `useAuthStore` (Zustand)
6. Redireciona para `/` (Dashboard)
7. Em cada rota protegida, `ProtectedRoute` verifica autenticação e permissão

### 3.2 Fluxo de Login (Portal do Cliente)

1. Usuário navega para `/portal/login`
2. Preenche e-mail e senha (conta `ClientPortalUser`, não `User`)
3. Frontend faz `POST /api/v1/portal/login`
4. Armazena token via `usePortalAuthStore`
5. Redireciona para `/portal` (Dashboard do Portal)

### 3.3 Multi-Tenant

- Após login, o usuário opera no contexto de um tenant (`current_tenant_id`)
- `GET /api/v1/my-tenants` lista os tenants que o usuário tem acesso
- `POST /api/v1/switch-tenant` alterna entre tenants
- Middleware `check.tenant` garante isolamento de dados

### 3.4 Credenciais de Teste

| Papel | E-mail | Senha | Tenant |
|-------|--------|-------|--------|
| **Super Admin** | `admin@sistema.local` | `password` | Calibrações Brasil (acesso a todos) |
| **Gerente** | `carlos@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Técnico 1** | `roberto@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Técnico 2** | `anderson@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Técnico 3** | `fernando@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Atendente** | `juliana@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Vendedor** | `marcos@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Motorista** | `jose@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Financeiro** | `ana@calibracoes.com.br` | `password` | Calibrações Brasil |
| **Admin T2** | `paulo@techassist.com.br` | `password` | TechAssist Serviços |
| **Admin T3** | `maria@medequip.com.br` | `password` | MedEquip Metrologia |

### 3.5 Roles e Permissões (RBAC)

**8 Roles no sistema:**

| Role | Nome Interno | Escopo |
|------|-------------|--------|
| Super Admin | `super_admin` | Acesso total a todos os módulos e tenants |
| Admin | `admin` | Tudo exceto `platform.*` |
| Gerente | `gerente` | Operações + Financeiro + Relatórios |
| Técnico | `tecnico` | OS (visualizar/atualizar), apontamentos, caixa, chamados |
| Atendente | `atendente` | Clientes, OS (criar/editar), recebíveis, chamados |
| Vendedor | `vendedor` | Clientes, OS (criar), orçamentos, comissões |
| Motorista | `motorista` | OS (visualizar), apontamentos |
| Financeiro | `financeiro` | Todo o módulo financeiro, comissões, despesas |

**120+ Permissões organizadas em 16 módulos:**

| Módulo | Recurso | Ações |
|--------|---------|-------|
| `iam` | `user` | view, create, update, delete |
| `iam` | `role` | view, create, update, delete |
| `iam` | `permission` | view, manage |
| `iam` | `audit_log` | view |
| `platform` | `tenant` | view, create, update, delete |
| `platform` | `branch` | view, create, update, delete |
| `platform` | `settings` | view, manage |
| `platform` | `dashboard` | view |
| `cadastros` | `customer` | view, create, update, delete |
| `cadastros` | `product` | view, create, update, delete |
| `cadastros` | `service` | view, create, update, delete |
| `cadastros` | `supplier` | view, create, update, delete |
| `os` | `work_order` | view, create, update, delete, assign, change_status, print, export |
| `technicians` | `technician` | view, create, update, delete |
| `technicians` | `schedule` | view, manage |
| `technicians` | `time_entry` | view, create, update, delete |
| `technicians` | `cashbox` | view, manage |
| `finance` | `receivable` | view, create, update, delete, settle |
| `finance` | `payable` | view, create, update, delete, settle |
| `finance` | `cashflow` | view |
| `finance` | `dre` | view |
| `finance` | `chart` | view, create, update, delete |
| `commissions` | `rule` | view, create, update, delete |
| `commissions` | `settlement` | view, create, approve |
| `commissions` | `dispute` | view, create, resolve |
| `commissions` | `goal` | view, create, update, delete |
| `commissions` | `campaign` | view, create, update, delete |
| `commissions` | `recurring` | view, create, update, delete |
| `expenses` | `expense` | view, create, update, delete, approve |
| `quotes` | `quote` | view, create, update, delete, approve, send |
| `service_calls` | `service_call` | view, create, update, delete, assign |
| `equipments` | `equipment` | view, create, update, delete |
| `estoque` | `movement` | view, create |
| `import` | `data` | view, execute, delete |
| `crm` | `deal` | view, create, update, delete |
| `crm` | `pipeline` | view, create, update, delete |
| `crm` | `message` | view, send |
| `notifications` | `notification` | view, update |
| `reports` | (13 sub-reports) | view, export |
| `inmetro` | `intelligence` | view, import, enrich, convert |
| `central` | `item` | view |
| `central` | (várias ações) | create.task, close.self, assign, manage.kpis, manage.rules |

---

## 4. Módulos do Sistema — Detalhamento

### 4.1 Dashboard (`/`)

- **Página:** `DashboardPage`
- **Permissão:** `platform.dashboard.view`
- **API:** `GET /api/v1/dashboard-stats`
- **Funcionalidades:**
  - Cards de resumo: receita, OS pendentes, itens vencidos
  - Gráficos de desempenho mensal
  - Feed de atividades recentes

---

### 4.2 Central — Inbox de Trabalho (`/central`)

- **Páginas:** `CentralPage`, `CentralDashboardPage`, `CentralRulesPage`
- **Rotas:** `/central`, `/central/dashboard`, `/central/regras`
- **Permissões:** `central.item.view`, `central.manage.kpis`, `central.manage.rules`
- **APIs:**
  - `GET /api/v1/central/items` — listar itens
  - `GET /api/v1/central/items/{id}` — detalhe
  - `POST /api/v1/central/items` — criar tarefa
  - `PATCH /api/v1/central/items/{id}` — atualizar/fechar
  - `POST /api/v1/central/items/{id}/assign` — atribuir
  - `POST /api/v1/central/items/{id}/comments` — comentar
  - `GET /api/v1/central/summary` — resumo
  - `GET /api/v1/central/kpis` — KPIs gerenciais
  - `GET /api/v1/central/workload` — carga de trabalho
  - `GET /api/v1/central/overdue-by-team` — atrasados por equipe
  - `GET/POST/PATCH/DELETE /api/v1/central/rules` — regras de automação

---

### 4.3 IAM — Gestão de Identidade e Acesso

#### 4.3.1 Usuários (`/iam/usuarios`)

- **Página:** `UsersPage`
- **Permissões:** `iam.user.view`, `iam.user.create`, `iam.user.update`, `iam.user.delete`
- **APIs:**
  - `GET /api/v1/users` — listar (paginado, com busca)
  - `GET /api/v1/users/{id}` — detalhe
  - `POST /api/v1/users` — criar
  - `PUT /api/v1/users/{id}` — editar
  - `DELETE /api/v1/users/{id}` — excluir
  - `POST /api/v1/users/{id}/toggle-active` — ativar/desativar
  - `POST /api/v1/users/bulk-toggle-active` — ativar/desativar em lote
  - `POST /api/v1/users/{id}/reset-password` — resetar senha
  - `POST /api/v1/users/{id}/force-logout` — forçar logout
  - `GET /api/v1/users/{id}/sessions` — sessões ativas
  - `DELETE /api/v1/users/{id}/sessions/{token}` — revogar sessão
  - `GET /api/v1/users/{id}/audit-trail` — histórico de auditoria
  - `GET /api/v1/users/stats` — estatísticas
  - `GET /api/v1/users/by-role/{role}` — por role
  - `GET /api/v1/users/export` — exportar CSV

#### 4.3.2 Roles (`/iam/roles`)

- **Página:** `RolesPage`
- **APIs:**
  - `GET /api/v1/roles` — listar
  - `GET /api/v1/roles/{id}` — detalhe
  - `POST /api/v1/roles` — criar
  - `PUT /api/v1/roles/{id}` — editar
  - `DELETE /api/v1/roles/{id}` — excluir
  - `POST /api/v1/roles/{id}/clone` — clonar role
  - `GET /api/v1/roles/{id}/users` — usuários do role

#### 4.3.3 Permissões (`/iam/permissoes`)

- **Página:** `PermissionsMatrixPage`
- **APIs:**
  - `GET /api/v1/permissions` — listar todas
  - `GET /api/v1/permissions/matrix` — matriz role×permissão
  - `POST /api/v1/permissions/toggle` — toggle inline

#### 4.3.4 Logs de Auditoria (`/admin/audit-log`, `/configuracoes/auditoria`)

- **Página:** `AuditLogPage`
- **Permissão:** `iam.audit_log.view`
- **APIs:**
  - `GET /api/v1/audit-logs` — listar
  - `GET /api/v1/audit-logs/{id}` — detalhe
  - `GET /api/v1/audit-logs/actions` — ações disponíveis
  - `GET /api/v1/audit-logs/entity-types` — tipos de entidade
  - `POST /api/v1/audit-logs/export` — exportar

---

### 4.4 Cadastros

#### 4.4.1 Clientes (`/cadastros/clientes`)

- **Página:** `CustomersPage`
- **Permissões:** `cadastros.customer.*`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/customers`
  - Fusão: `POST /api/v1/customers/merge`, `GET /api/v1/customers/search-duplicates`
- **Página extra:** `CustomerMergePage` (`/cadastros/clientes/fusao`)
- **Dados do cliente:** nome, documento (CPF/CNPJ), tipo (PF/PJ), telefone, e-mail, endereço (cidade, estado), status ativo/inativo

#### 4.4.2 Produtos (`/cadastros/produtos`)

- **Página:** `ProductsPage`
- **Permissões:** `cadastros.product.*`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/products`
  - Categorias: `GET/POST/PUT/DELETE /api/v1/product-categories`

#### 4.4.3 Serviços (`/cadastros/servicos`)

- **Página:** `ServicesPage`
- **Permissões:** `cadastros.service.*`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/services`
  - Categorias: `GET/POST/PUT/DELETE /api/v1/service-categories`

#### 4.4.4 Fornecedores (`/cadastros/fornecedores`)

- **Página:** `SuppliersPage`
- **Permissões:** `cadastros.supplier.*`
- **APIs:** CRUD: `GET/POST/PUT/DELETE /api/v1/suppliers`

#### 4.4.5 Histórico de Preços (`/cadastros/historico-precos`)

- **Página:** `PriceHistoryPage`
- **APIs:**
  - `GET /api/v1/price-history`
  - `GET /api/v1/products/{id}/price-history`
  - `GET /api/v1/services/{id}/price-history`

#### 4.4.6 Exportação em Lote (`/cadastros/exportacao-lote`)

- **Página:** `BatchExportPage`
- **APIs:**
  - `GET /api/v1/batch-export/entities`
  - `POST /api/v1/batch-export/csv`
  - `POST /api/v1/batch-export/print`

---

### 4.5 Ordens de Serviço — OS

#### 4.5.1 Lista e Kanban (`/os`, `/os/kanban`)

- **Páginas:** `WorkOrdersListPage`, `WorkOrderKanbanPage`
- **Permissões:** `os.work_order.*`
- **Fluxo de Status:** `Aberta` → `Em andamento` → `Concluída` → `Faturada`
- **APIs:**
  - `GET /api/v1/work-orders` — lista (paginada, com filtros)
  - `GET /api/v1/work-orders/{id}` — detalhe
  - `GET /api/v1/work-orders-metadata` — metadados (status, tipos)
  - `POST /api/v1/work-orders` — criar
  - `PUT /api/v1/work-orders/{id}` — editar
  - `DELETE /api/v1/work-orders/{id}` — excluir
  - `POST|PATCH /api/v1/work-orders/{id}/status` — mudar status
  - `POST /api/v1/work-orders/{id}/reopen` — reabrir OS concluída
  - `POST /api/v1/work-orders/{id}/duplicate` — duplicar
  - `GET /api/v1/work-orders-export` — exportar CSV
  - `GET /api/v1/work-orders-dashboard-stats` — estatísticas

#### 4.5.2 Itens da OS

- **APIs:**
  - `POST /api/v1/work-orders/{id}/items` — adicionar item
  - `PUT /api/v1/work-orders/{id}/items/{item}` — editar item
  - `DELETE /api/v1/work-orders/{id}/items/{item}` — remover item

#### 4.5.3 Anexos e Assinatura

- **APIs:**
  - `GET /api/v1/work-orders/{id}/attachments` — listar anexos
  - `POST /api/v1/work-orders/{id}/attachments` — upload
  - `DELETE /api/v1/work-orders/{id}/attachments/{att}` — excluir
  - `POST /api/v1/work-orders/{id}/signature` — salvar assinatura digital

#### 4.5.4 Equipamentos da OS

- **APIs:**
  - `POST /api/v1/work-orders/{id}/equipments` — vincular equipamento
  - `DELETE /api/v1/work-orders/{id}/equipments/{eq}` — desvincular

#### 4.5.5 Contratos Recorrentes (`/os/contratos-recorrentes`)

- **Página:** `RecurringContractsPage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/recurring-contracts`
  - `POST /api/v1/recurring-contracts/{id}/generate` — gerar OS a partir do contrato

#### 4.5.6 Checklists de Serviço (`/os/checklists`)

- **Página:** `ServiceChecklistsPage`
- **APIs:**
  - CRUD: `/api/v1/service-checklists`
  - `GET /api/v1/work-orders/{id}/checklist-responses` — respostas
  - `POST /api/v1/work-orders/{id}/checklist-responses` — preencher

#### 4.5.7 Políticas SLA (`/os/sla`, `/os/sla-dashboard`)

- **Páginas:** `SlaPoliciesPage`, `SlaDashboardPage`
- **APIs:**
  - CRUD: `/api/v1/sla-policies`
  - `GET /api/v1/sla-dashboard/overview`
  - `GET /api/v1/sla-dashboard/breached`
  - `GET /api/v1/sla-dashboard/by-policy`

#### 4.5.8 PDF/Impressão

- **API:** `GET /api/v1/work-orders/{id}/pdf`

---

### 4.6 Orçamentos (`/orcamentos`)

- **Páginas:** `QuotesListPage`, `QuoteCreatePage`, `QuoteDetailPage`, `QuoteEditPage`
- **Rotas:** `/orcamentos`, `/orcamentos/novo`, `/orcamentos/:id`, `/orcamentos/:id/editar`
- **Permissões:** `quotes.quote.*`
- **Fluxo de Status:** `Rascunho` → `Enviado` → `Aprovado` / `Rejeitado` → `Convertido em OS`
- **APIs:**
  - `GET /api/v1/quotes` — listar
  - `GET /api/v1/quotes/{id}` — detalhe
  - `POST /api/v1/quotes` — criar
  - `PUT /api/v1/quotes/{id}` — editar
  - `DELETE /api/v1/quotes/{id}` — excluir
  - `POST /api/v1/quotes/{id}/approve` — aprovar
  - `POST /api/v1/quotes/{id}/reject` — rejeitar
  - `POST /api/v1/quotes/{id}/send` — enviar ao cliente
  - `POST /api/v1/quotes/{id}/convert-to-os` — converter em OS
  - `POST /api/v1/quotes/{id}/duplicate` — duplicar
  - `POST /api/v1/quotes/{id}/reopen` — reabrir
  - `GET /api/v1/quotes-summary` — resumo
  - `GET /api/v1/quotes/{id}/timeline` — histórico
  - `GET /api/v1/quotes-export` — CSV
  - Equipamentos: `POST /api/v1/quotes/{id}/equipments`, `PUT/DELETE`
  - Itens: `POST /api/v1/quote-equipments/{eq}/items`, `PUT/DELETE`
  - Fotos: `POST /api/v1/quotes/{id}/photos`, `DELETE`
  - **PDF:** `GET /api/v1/quotes/{id}/pdf`
  - **Link público:** `GET /api/v1/quotes/{id}/public-view` (sem autenticação, com token)
  - **Aprovação pública:** `POST /api/v1/quotes/{id}/public-approve`

---

### 4.7 Chamados Técnicos (`/chamados`)

- **Páginas:** `ServiceCallsPage`, `ServiceCallCreatePage`, `ServiceCallDetailPage`, `ServiceCallMapPage`, `TechnicianAgendaPage`
- **Rotas:** `/chamados`, `/chamados/novo`, `/chamados/:id`, `/chamados/mapa`, `/chamados/agenda`
- **Permissões:** `service_calls.service_call.*`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/service-calls`
  - `PUT /api/v1/service-calls/{id}/status` — mudar status
  - `PUT /api/v1/service-calls/{id}/assign` — atribuir técnico
  - `POST /api/v1/service-calls/{id}/convert-to-os` — converter em OS
  - `GET /api/v1/service-calls-map` — dados para mapa interativo
  - `GET /api/v1/service-calls-agenda` — visão agenda/calendário
  - `GET /api/v1/service-calls-summary` — resumo
  - `GET /api/v1/service-calls-export` — CSV
  - `GET /api/v1/service-calls-assignees` — técnicos disponíveis
  - Comentários: `GET/POST /api/v1/service-calls/{id}/comments`

---

### 4.8 Gestão de Técnicos

#### 4.8.1 Agendamentos (`/tecnicos/agenda`)

- **Página:** `SchedulesPage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/schedules`
  - `GET /api/v1/schedules-unified` — visão unificada
  - `GET /api/v1/schedules/conflicts` — conflitos de agenda
  - `GET /api/v1/schedules/workload` — carga de trabalho
  - `GET /api/v1/schedules/suggest-routing` — sugestão de rotas

#### 4.8.2 Apontamentos de Horas (`/tecnicos/apontamentos`)

- **Página:** `TimeEntriesPage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/time-entries`
  - `POST /api/v1/time-entries/start` — iniciar cronômetro
  - `POST /api/v1/time-entries/{id}/stop` — parar cronômetro
  - `GET /api/v1/time-entries-summary` — resumo

#### 4.8.3 Caixa do Técnico (`/tecnicos/caixa`)

- **Página:** `TechnicianCashPage`
- **APIs:**
  - `GET /api/v1/technician-cash` — listar
  - `GET /api/v1/technician-cash/{userId}` — detalhe
  - `GET /api/v1/technician-cash-summary` — resumo
  - `POST /api/v1/technician-cash/credit` — crédito
  - `POST /api/v1/technician-cash/debit` — débito

---

### 4.9 Financeiro

#### 4.9.1 Contas a Receber (`/financeiro/receber`)

- **Página:** `AccountsReceivablePage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/accounts-receivable`
  - `POST /api/v1/accounts-receivable/{id}/pay` — baixar pagamento
  - `POST /api/v1/accounts-receivable/generate-from-os` — gerar a partir de OS
  - `POST /api/v1/accounts-receivable/installments` — gerar parcelas
  - `GET /api/v1/accounts-receivable-summary` — resumo

#### 4.9.2 Contas a Pagar (`/financeiro/pagar`)

- **Página:** `AccountsPayablePage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/accounts-payable`
  - `POST /api/v1/accounts-payable/{id}/pay` — baixar pagamento
  - `GET /api/v1/accounts-payable-summary` — resumo
  - Categorias: `GET/POST/PUT/DELETE /api/v1/account-payable-categories`

#### 4.9.3 Pagamentos (`/financeiro/pagamentos`)

- **Página:** `PaymentsPage`
- **APIs:**
  - `GET /api/v1/payments` — listar
  - `GET /api/v1/payments-summary` — resumo
  - `DELETE /api/v1/payments/{id}` — estornar

#### 4.9.4 Formas de Pagamento (`/financeiro/formas-pagamento`)

- **Página:** `PaymentMethodsPage`
- **APIs:** CRUD: `GET/POST/PUT/DELETE /api/v1/payment-methods`

#### 4.9.5 Fluxo de Caixa e DRE (`/financeiro/fluxo-caixa`)

- **Página:** `CashFlowPage`
- **APIs:**
  - `GET /api/v1/cash-flow` — fluxo de caixa
  - `GET /api/v1/dre` — DRE (Demonstrativo de Resultados)
  - `GET /api/v1/cash-flow/dre-comparativo` — DRE comparativo

#### 4.9.6 Faturamento/NF (`/financeiro/faturamento`)

- **Página:** `InvoicesPage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/invoices`
  - `GET /api/v1/invoices/metadata`

#### 4.9.7 Conciliação Bancária (`/financeiro/conciliacao-bancaria`)

- **Página:** `BankReconciliationPage`
- **APIs:**
  - `GET /api/v1/bank-reconciliation/statements`
  - `GET /api/v1/bank-reconciliation/statements/{id}/entries`
  - `POST /api/v1/bank-reconciliation/import`
  - `POST /api/v1/bank-reconciliation/entries/{id}/match`
  - `POST /api/v1/bank-reconciliation/entries/{id}/ignore`

#### 4.9.8 Plano de Contas (`/financeiro/plano-contas`)

- **Página:** `ChartOfAccountsPage`
- **APIs:** CRUD: `GET/POST/PUT/DELETE /api/v1/chart-of-accounts`

#### 4.9.9 Exportação Financeira

- **APIs:**
  - `GET /api/v1/financial/export/ofx`
  - `GET /api/v1/financial/export/csv`

---

### 4.10 Comissões (`/financeiro/comissoes`)

- **Páginas:** `CommissionsPage`, `CommissionDashboardPage`
- **Rotas:** `/financeiro/comissoes`, `/financeiro/comissoes/dashboard`
- **Sub-módulos:**

| Sub-módulo | APIs | Descrição |
|-----------|------|-----------|
| Regras | CRUD `/api/v1/commission-rules` | Definir % e critérios |
| Eventos | `GET /api/v1/commission-events` | Eventos de comissão gerados |
| Liquidações | `POST /api/v1/commission-settlements/close`, `/pay`, `/reopen` | Fechar, pagar, reabrir |
| Disputas | CRUD `/api/v1/commission-disputes` | Contestações |
| Metas | CRUD `/api/v1/commission-goals` | Metas de vendas |
| Campanhas | CRUD `/api/v1/commission-campaigns` | Aceleradores |
| Recorrentes | CRUD `/api/v1/recurring-commissions` | Comissões recorrentes |
| Dashboard | `GET /api/v1/commission-dashboard/*` | Overview, ranking, evolução, por regra, por role |
| Simulação | `POST /api/v1/commission-simulate` | Simular comissão |
| Extrato PDF | `GET /api/v1/commission-statement/pdf` | Download do extrato |
| Exportação | `GET /api/v1/commission-events/export`, `/settlements/export` | CSV |
| Splits | `GET/POST /api/v1/commission-events/{id}/splits` | Dividir comissão |
| Batch | `POST /api/v1/commission-events/batch-status` | Alterar status em lote |

---

### 4.11 Despesas (`/financeiro/despesas`)

- **Página:** `ExpensesPage`
- **Permissões:** `expenses.expense.*`
- **Fluxo de Status:** `Pendente` → `Aprovada` / `Rejeitada`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/expenses`
  - `GET /api/v1/expenses/{id}/history` — histórico
  - `PUT /api/v1/expenses/{id}/status` — aprovar/rejeitar
  - `POST /api/v1/expenses/batch-status` — aprovar/rejeitar em lote
  - `POST /api/v1/expenses/{id}/duplicate` — duplicar
  - `GET /api/v1/expense-summary` — resumo
  - `GET /api/v1/expense-analytics` — analytics
  - `GET /api/v1/expenses-export` — CSV
  - Categorias: `GET/POST/PUT/DELETE /api/v1/expense-categories`

---

### 4.12 Equipamentos (`/equipamentos`)

- **Páginas:** `EquipmentListPage`, `EquipmentCreatePage`, `EquipmentDetailPage`, `EquipmentCalendarPage`
- **Rotas:** `/equipamentos`, `/equipamentos/novo`, `/equipamentos/:id`, `/agenda-calibracoes`
- **Permissões:** `equipments.equipment.*`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/equipments`
  - `GET /api/v1/equipments-dashboard` — dashboard
  - `GET /api/v1/equipments-alerts` — alertas de vencimento
  - `GET /api/v1/equipments-constants` — constantes (tipos, categorias)
  - `GET /api/v1/equipments/{id}/calibrations` — histórico de calibrações
  - `POST /api/v1/equipments/{id}/calibrations` — registrar calibração
  - `POST /api/v1/equipments/{id}/maintenances` — registrar manutenção
  - `POST /api/v1/equipments/{id}/documents` — upload de documento
  - `DELETE /api/v1/equipment-documents/{doc}` — excluir documento
  - `GET /api/v1/equipments-export` — CSV
  - **PDF:** `GET /api/v1/equipments/{id}/calibrations/{cal}/pdf` — certificado de calibração

**Dados do equipamento:** código, tipo, categoria, marca, fabricante, modelo, número de série, capacidade, unidade, resolução, classe de precisão, status (`ativo`, `em_manutencao`, etc.), localização, intervalo de calibração, última/próxima calibração, criticidade

---

### 4.13 Estoque (`/estoque`)

- **Páginas:** `StockDashboardPage`, `StockMovementsPage`
- **Rotas:** `/estoque`, `/estoque/movimentacoes`
- **Permissões:** `estoque.movement.*`
- **APIs:**
  - `GET /api/v1/stock/movements` — movimentações
  - `POST /api/v1/stock/movements` — registrar
  - `GET /api/v1/stock/summary` — resumo
  - `GET /api/v1/stock/low-stock-alerts` — alertas de estoque baixo

---

### 4.14 CRM (`/crm`)

- **Páginas:** `CrmDashboardPage`, `CrmPipelinePage`, `Customer360Page`, `MessageTemplatesPage`
- **Rotas:** `/crm`, `/crm/pipeline`, `/crm/pipeline/:id`, `/crm/clientes/:id`, `/crm/templates`
- **Sub-módulos:**

| Sub-módulo | APIs |
|-----------|------|
| Dashboard | `GET /api/v1/crm/dashboard` |
| Negócios (Deals) | CRUD `/api/v1/crm/deals`, stage update, mark won/lost |
| Atividades | CRUD `/api/v1/crm/activities` |
| Pipelines | CRUD `/api/v1/crm/pipelines`, stages CRUD, reorder |
| Visão 360 | `GET /api/v1/crm/customers/{id}/360` |
| Mensagens | `GET/POST /api/v1/crm/messages`, templates CRUD |
| Constantes | `GET /api/v1/crm/constants` |
| Webhooks | `POST /webhooks/whatsapp`, `POST /webhooks/email` |

---

### 4.15 Inteligência INMETRO (`/inmetro`)

- **Páginas:** `InmetroDashboardPage`, `InmetroLeadsPage`, `InmetroInstrumentsPage`, `InmetroImportPage`, `InmetroCompetitorsPage`, `InmetroOwnerDetailPage`
- **Rotas:** `/inmetro`, `/inmetro/leads`, `/inmetro/instrumentos`, `/inmetro/importacao`, `/inmetro/concorrentes`, `/inmetro/owners/:id`
- **Permissões:** `inmetro.intelligence.view`, `.import`, `.enrich`, `.convert`
- **APIs:**
  - `GET /api/v1/inmetro/dashboard` — dashboard
  - `GET /api/v1/inmetro/owners` — proprietários/leads
  - `GET /api/v1/inmetro/owners/{id}` — detalhe
  - `GET /api/v1/inmetro/instruments` — instrumentos
  - `GET /api/v1/inmetro/leads` — leads
  - `GET /api/v1/inmetro/competitors` — concorrentes
  - `GET /api/v1/inmetro/cities` — cidades
  - `GET /api/v1/inmetro/conversion-stats` — estatísticas de conversão
  - `POST /api/v1/inmetro/import/xml` — importar XML
  - `POST /api/v1/inmetro/import/psie-init` — iniciar scraping PSIE
  - `POST /api/v1/inmetro/import/psie-results` — enviar resultados PSIE
  - `POST /api/v1/inmetro/enrich/{id}` — enriquecer dados
  - `POST /api/v1/inmetro/enrich-batch` — enriquecer em lote
  - `POST /api/v1/inmetro/convert/{id}` — converter em cliente
  - `PATCH /api/v1/inmetro/owners/{id}/status` — atualizar status do lead
  - `PUT /api/v1/inmetro/owners/{id}` — editar proprietário
  - `DELETE /api/v1/inmetro/owners/{id}` — excluir
  - Exportação: `GET /api/v1/inmetro/export/leads`, `/instruments`

---

### 4.16 Relatórios (`/relatorios`)

- **Página:** `ReportsPage` (multi-abas)
- **13 tipos de relatório:**

| Relatório | API | Permissão |
|-----------|-----|-----------|
| Ordens de Serviço | `GET /api/v1/reports/work-orders` | `reports.os_report.view` |
| Produtividade | `GET /api/v1/reports/productivity` | `reports.productivity_report.view` |
| Financeiro | `GET /api/v1/reports/financial` | `reports.financial_report.view` |
| Comissões | `GET /api/v1/reports/commissions` | `reports.commission_report.view` |
| Rentabilidade | `GET /api/v1/reports/profitability` | `reports.margin_report.view` |
| Orçamentos | `GET /api/v1/reports/quotes` | `reports.quotes_report.view` |
| Chamados | `GET /api/v1/reports/service-calls` | `reports.service_calls_report.view` |
| Caixa Técnico | `GET /api/v1/reports/technician-cash` | `reports.technician_cash_report.view` |
| CRM | `GET /api/v1/reports/crm` | `reports.crm_report.view` |
| Equipamentos | `GET /api/v1/reports/equipments` | `reports.equipments_report.view` |
| Fornecedores | `GET /api/v1/reports/suppliers` | `reports.suppliers_report.view` |
| Estoque | `GET /api/v1/reports/stock` | `reports.stock_report.view` |
| Clientes | `GET /api/v1/reports/customers` | `reports.customers_report.view` |

- **Exportação:** `GET /api/v1/reports/{type}/export`

---

### 4.17 Importação de Dados (`/importacao`)

- **Página:** `ImportPage`
- **Permissões:** `import.data.view`, `.execute`, `.delete`
- **APIs:**
  - `GET /api/v1/import/fields/{entity}` — campos disponíveis
  - `POST /api/v1/import/upload` — upload de arquivo
  - `POST /api/v1/import/preview` — pré-visualização
  - `POST /api/v1/import/execute` — executar importação
  - `GET /api/v1/import/history` — histórico
  - `GET /api/v1/import/{id}` — detalhe
  - `GET /api/v1/import/{id}/errors` — erros da importação
  - `POST /api/v1/import/{id}/rollback` — desfazer importação
  - `DELETE /api/v1/import/{id}` — excluir registro
  - Templates: CRUD `/api/v1/import/templates`
  - `GET /api/v1/import/sample/{entity}` — download de modelo
  - `GET /api/v1/import/export/{entity}` — exportar dados existentes
  - `GET /api/v1/import-stats` — estatísticas
  - `GET /api/v1/import-entity-counts` — contagem por entidade

---

### 4.18 Notificações (`/notificacoes`)

- **Página:** `NotificationsPage`
- **APIs:**
  - `GET /api/v1/notifications` — listar
  - `GET /api/v1/notifications/unread-count` — contagem não lidas
  - `PUT /api/v1/notifications/{id}/read` — marcar como lida
  - `PUT /api/v1/notifications/read-all` — marcar todas como lidas

---

### 4.19 Configurações

#### 4.19.1 Configurações Gerais (`/configuracoes`)

- **Página:** `SettingsPage`
- **APIs:**
  - `GET /api/v1/settings`
  - `PUT /api/v1/settings`

#### 4.19.2 Filiais (`/configuracoes/filiais`)

- **Página:** `BranchesPage`
- **APIs:** CRUD: `GET/POST/PUT/DELETE /api/v1/branches`

#### 4.19.3 Empresas/Tenants (`/configuracoes/empresas`)

- **Página:** `TenantManagementPage`
- **APIs:**
  - CRUD: `GET/POST/PUT/DELETE /api/v1/tenants`
  - `GET /api/v1/tenants-stats`
  - `POST /api/v1/tenants/{id}/invite`
  - `DELETE /api/v1/tenants/{id}/users/{user}`

#### 4.19.4 Perfil do Usuário (`/perfil`)

- **Página:** `ProfilePage`
- **APIs:**
  - `GET /api/v1/profile`
  - `PUT /api/v1/profile`
  - `POST /api/v1/profile/change-password`

---

### 4.20 Portal do Cliente

- **Rotas:** `/portal/login`, `/portal`, `/portal/os`, `/portal/orcamentos`, `/portal/financeiro`, `/portal/chamados/novo`
- **Páginas:** `PortalLoginPage`, `PortalDashboardPage`, `PortalWorkOrdersPage`, `PortalQuotesPage`, `PortalFinancialsPage`, `PortalServiceCallPage`
- **APIs (prefixo `/api/v1/portal/`):**
  - `POST /login` — login do portal
  - `POST /logout` — logout
  - `GET /me` — dados do cliente
  - `GET /work-orders` — OS do cliente
  - `GET /quotes` — orçamentos do cliente
  - `POST|PUT /quotes/{id}/status` — aprovar/rejeitar orçamento
  - `GET /financials` — dados financeiros
  - `POST /service-calls` — abrir chamado

---

### 4.21 APIs Externas (`/api/v1/external/`)

| API | Endpoint | Descrição |
|-----|----------|-----------|
| CEP | `GET /external/cep/{cep}` | Consulta endereço por CEP |
| CNPJ | `GET /external/cnpj/{cnpj}` | Consulta dados por CNPJ |
| Feriados | `GET /external/holidays/{year}` | Feriados nacionais |
| Bancos | `GET /external/banks` | Lista de bancos |
| DDD | `GET /external/ddd/{ddd}` | Cidades por DDD |
| Estados | `GET /external/states` | Lista de estados |
| Cidades | `GET /external/states/{uf}/cities` | Cidades por UF |

---

## 5. Mapa de Navegação do Frontend

```
/ (Dashboard)
├── /central (Inbox)
│   ├── /central/dashboard (KPIs)
│   └── /central/regras (Automação)
├── /iam
│   ├── /iam/usuarios
│   ├── /iam/roles
│   └── /iam/permissoes
├── /admin/audit-log
├── /cadastros
│   ├── /cadastros/clientes
│   ├── /cadastros/clientes/fusao
│   ├── /cadastros/produtos
│   ├── /cadastros/servicos
│   ├── /cadastros/fornecedores
│   ├── /cadastros/historico-precos
│   └── /cadastros/exportacao-lote
├── /orcamentos
│   ├── /orcamentos/novo
│   ├── /orcamentos/:id
│   └── /orcamentos/:id/editar
├── /chamados
│   ├── /chamados/novo
│   ├── /chamados/:id
│   ├── /chamados/mapa
│   └── /chamados/agenda
├── /os
│   ├── /os/kanban
│   ├── /os/nova
│   ├── /os/:id
│   ├── /os/contratos-recorrentes
│   ├── /os/sla
│   ├── /os/sla-dashboard
│   └── /os/checklists
├── /tecnicos
│   ├── /tecnicos/agenda
│   ├── /tecnicos/apontamentos
│   └── /tecnicos/caixa
├── /financeiro
│   ├── /financeiro/receber
│   ├── /financeiro/pagar
│   ├── /financeiro/comissoes
│   ├── /financeiro/comissoes/dashboard
│   ├── /financeiro/despesas
│   ├── /financeiro/pagamentos
│   ├── /financeiro/formas-pagamento
│   ├── /financeiro/fluxo-caixa
│   ├── /financeiro/faturamento
│   ├── /financeiro/conciliacao-bancaria
│   ├── /financeiro/plano-contas
│   └── /financeiro/categorias-pagar
├── /estoque
│   └── /estoque/movimentacoes
├── /equipamentos
│   ├── /equipamentos/novo
│   └── /equipamentos/:id
├── /agenda-calibracoes
├── /crm
│   ├── /crm/pipeline
│   ├── /crm/pipeline/:id
│   ├── /crm/clientes/:id (360°)
│   └── /crm/templates
├── /inmetro
│   ├── /inmetro/leads
│   ├── /inmetro/instrumentos
│   ├── /inmetro/importacao
│   ├── /inmetro/concorrentes
│   └── /inmetro/owners/:id
├── /relatorios
├── /notificacoes
├── /importacao
├── /configuracoes
│   ├── /configuracoes/filiais
│   ├── /configuracoes/empresas
│   └── /configuracoes/auditoria
├── /perfil
└── /login

Portal do Cliente:
├── /portal/login
├── /portal (Dashboard)
├── /portal/os
├── /portal/orcamentos
├── /portal/financeiro
└── /portal/chamados/novo
```

---

## 6. Dados de Exemplo no Seeder

### Tenants

| Tenant | Documento | Filiais |
|--------|----------|---------|
| Calibrações Brasil | 12.345.678/0001-90 | Matriz SP, Filial RJ |
| TechAssist Serviços | 98.765.432/0001-10 | Sede Central (Campinas) |
| MedEquip Metrologia | 11.222.333/0001-44 | Laboratório BH |

### Clientes (Tenant 1)

- Supermercado Bom Preço (PJ, São Paulo)
- Farmácia Popular Center (PJ, Guarulhos)
- Indústria Metalúrgica Forte (PJ, Osasco)
- Padaria Pão Dourado (PJ, Santo André)

### Equipamentos (6 balanças)

- EQP-00001: Toledo Prix 3 Plus, 30kg, Classe III (crítico, calibração quase vencendo)
- EQP-00002: Toledo Prix 4 Uno, 15kg, Classe III (calibração vencida)
- EQP-00003: Shimadzu AUW220D, 0.220kg, Classe I (crítico, INMETRO)
- EQP-00004: Filizola ID-M 150, 150kg, Classe III
- EQP-00005: Toledo Conquista 2040, 60.000kg, Classe IIII (em manutenção, rodoviária)
- EQP-00006: Marte AD3300, 3.3kg, Classe II (calibração vencida recentemente)

---

## 7. Padrões de Interação (UX)

### Toda lista deve ter

- Título + contagem de registros
- Botão "Novo" (canto superior direito, primário)
- Barra de busca (filtro instantâneo)
- Filtros de status/data
- Tabela paginada com colunas ordenáveis
- Ações na linha: Visualizar, Editar, Excluir
- Estado vazio com ícone + mensagem + botão criar
- Skeleton de carregamento

### Todo formulário deve ter

- Labels acima dos campos
- Campos obrigatórios marcados com *
- Validação client-side + server-side
- Mensagens de erro inline
- Botão submit desabilitado + spinner durante save
- Sucesso → toast verde + redirect
- Erro → toast vermelho + erros inline

### Toda exclusão deve seguir

1. Clique em excluir → diálogo de confirmação
2. Botões: Cancelar (secundário) + Excluir (vermelho/danger)
3. Confirmar → loading no botão
4. Sucesso → toast "Excluído com sucesso" + lista atualiza
5. Erro → toast com mensagem

---

## 8. Informações Técnicas para Testes

### Base URL da API

- **Backend:** `http://localhost:8000/api/v1`
- **Frontend:** `http://localhost:5173`

### Headers de Autenticação

```
Authorization: Bearer {token}
Accept: application/json
Content-Type: application/json
```

### Throttle

- Login: 60 requisições por minuto

### Padrão de Resposta da API

```json
{
  "data": { ... },
  "message": "Sucesso",
  "meta": { "current_page": 1, "last_page": 5, "total": 100 }
}
```

### Padrão de Erro (422 - Validação)

```json
{
  "message": "Validation failed",
  "errors": {
    "field_name": ["Mensagem de erro"]
  }
}
```

### Padrão de Erro (403 - Sem Permissão)

```json
{
  "message": "You do not have permission"
}
```

### Padrão de Erro (500 - Erro Interno)

```json
{
  "message": "Internal error"
}
```
