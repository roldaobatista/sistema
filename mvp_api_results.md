# KALIBRIUM ERP — Teste de API Real
> Gerado em: 2026-02-15 00:23:25
> Login: ✅ Autenticado

## Resumo

| Status | Qtd |
|--------|-----|
| ✅ OK (200/201) | 57 |
| 🔒 Auth (401/403) | 0 |
| ❌ Not Found (404) | 6 |
| 💥 Server Error (500) | 1 |
| 🟡 Outros | 0 |

## Detalhes

| Módulo | Método | Path | Status | Dados |
|--------|--------|------|--------|-------|
| Dashboard | GET | `/api/v1/dashboard-stats` | ✅ 200 OK | JSON ok |
| Auth - Me | GET | `/api/v1/me` | ✅ 200 OK | JSON ok |
| Usuários | GET | `/api/v1/users` | ✅ 200 OK | 9 registros |
| Roles | GET | `/api/v1/roles` | ✅ 200 OK | JSON ok |
| Permissões | GET | `/api/v1/permissions` | ✅ 200 OK | JSON ok |
| Audit Log | GET | `/api/v1/audit-logs` | ✅ 200 OK | 30 registros |
| Clientes | GET | `/api/v1/customers` | ✅ 200 OK | 1 registros |
| Produtos | GET | `/api/v1/products` | ✅ 200 OK | 0 registros |
| Serviços | GET | `/api/v1/services` | ✅ 200 OK | 0 registros |
| Fornecedores | GET | `/api/v1/suppliers` | ✅ 200 OK | 0 registros |
| Orçamentos | GET | `/api/v1/quotes` | ✅ 200 OK | 0 registros |
| Chamados | GET | `/api/v1/service-calls` | ✅ 200 OK | 0 registros |
| Ordens de Serviço | GET | `/api/v1/work-orders` | ✅ 200 OK | 0 registros |
| OS Metadata | GET | `/api/v1/work-orders-metadata` | ✅ 200 OK | JSON ok |
| Contratos Recorrentes | GET | `/api/v1/recurring-contracts` | ✅ 200 OK | 0 registros |
| Agenda | GET | `/api/v1/schedules` | ✅ 200 OK | 0 registros |
| Apontamentos | GET | `/api/v1/time-entries` | ✅ 200 OK | 0 registros |
| Contas Receber | GET | `/api/v1/accounts-receivable` | ✅ 200 OK | 0 registros |
| Contas Pagar | GET | `/api/v1/accounts-payable` | ✅ 200 OK | 0 registros |
| Pagamentos | GET | `/api/v1/payments` | ✅ 200 OK | 0 registros |
| Formas Pagamento | GET | `/api/v1/payment-methods` | ✅ 200 OK | JSON ok |
| Caixa | GET | `/api/v1/cash-flow` | ✅ 200 OK | JSON ok |
| Faturamento | GET | `/api/v1/invoices` | ✅ 200 OK | 0 registros |
| Conciliação | GET | `/api/v1/bank-reconciliation/summary` | ✅ 200 OK | tem data |
| Plano Contas | GET | `/api/v1/chart-of-accounts` | ✅ 200 OK | 0 registros |
| ⭐ Comissões Regras | GET | `/api/v1/commission-rules` | ✅ 200 OK | JSON ok |
| ⭐ Comissões Eventos | GET | `/api/v1/commission-events` | ✅ 200 OK | 0 registros |
| ⭐ Comissões Dashboard | GET | `/api/v1/commission-dashboard` | ❌ 404 Not Found | The route api/v1/commission-dashboard co |
| ⭐ Comissões Fechamentos | GET | `/api/v1/commission-settlements` | ✅ 200 OK | JSON ok |
| ⭐ Comissões Disputas | GET | `/api/v1/commission-disputes` | ✅ 200 OK | JSON ok |
| ⭐ Comissões Metas | GET | `/api/v1/commission-goals` | ✅ 200 OK | JSON ok |
| ⭐ Comissões Campanhas | GET | `/api/v1/commission-campaigns` | ✅ 200 OK | JSON ok |
| ⭐ Despesas Lista | GET | `/api/v1/expenses` | ✅ 200 OK | 0 registros |
| ⭐ Despesas Categorias | GET | `/api/v1/expense-categories` | ✅ 200 OK | JSON ok |
| ⭐ Abastecimento | GET | `/api/v1/fueling-logs` | ✅ 200 OK | 0 registros |
| ⭐ Caixa Técnico | GET | `/api/v1/technician-cash` | ✅ 200 OK | JSON ok |
| ⭐ Transferências | GET | `/api/v1/fund-transfers` | ✅ 200 OK | 0 registros |
| ⭐ Adiantamentos | GET | `/api/v1/technician-advances` | ❌ 404 Not Found | The route api/v1/technician-advances cou |
| Estoque Resumo | GET | `/api/v1/stock/summary` | ✅ 200 OK | JSON ok |
| Movimentações | GET | `/api/v1/stock/movements` | ✅ 200 OK | 0 registros |
| Armazéns | GET | `/api/v1/warehouses` | ✅ 200 OK | 0 registros |
| Inventários | GET | `/api/v1/inventories` | ✅ 200 OK | 0 registros |
| Intel. Estoque | GET | `/api/v1/stock/intelligence/abc-curve` | ✅ 200 OK | 0 registros |
| Equipamentos | GET | `/api/v1/equipments` | ✅ 200 OK | 0 registros |
| Pesos Padrão | GET | `/api/v1/standard-weights` | ✅ 200 OK | 0 registros |
| INMETRO Dashboard | GET | `/api/v1/inmetro/dashboard` | ✅ 200 OK | JSON ok |
| INMETRO Leads | GET | `/api/v1/inmetro/leads` | ✅ 200 OK | 0 registros |
| INMETRO Instrumentos | GET | `/api/v1/inmetro/instruments` | ✅ 200 OK | 0 registros |
| Notas Fiscais | GET | `/api/v1/fiscal/notas` | ✅ 200 OK | 0 registros |
| CRM Dashboard | GET | `/api/v1/crm/dashboard` | ✅ 200 OK | JSON ok |
| Email Contas | GET | `/api/v1/email/accounts` | ❌ 404 Not Found | The route api/v1/email/accounts could no |
| Import Histórico | GET | `/api/v1/import/history` | ✅ 200 OK | 0 registros |
| Relatório OS | GET | `/api/v1/reports/work-orders` | ✅ 200 OK | JSON ok |
| Relatório Financeiro | GET | `/api/v1/reports/financial` | ✅ 200 OK | JSON ok |
| Notificações | GET | `/api/v1/notifications` | ✅ 200 OK | JSON ok |
| Checklists | GET | `/api/v1/checklists` | 💥 500 Server Error | Erro ao listar checklists |
| SLA Policies | GET | `/api/v1/sla-policies` | ✅ 200 OK | 0 registros |
| Frota Veículos | GET | `/api/v1/fleet/vehicles` | ✅ 200 OK | 0 registros |
| Frota Dashboard | GET | `/api/v1/fleet/dashboard` | ✅ 200 OK | tem data |
| RH Funcionários | GET | `/api/v1/hr/employees` | ❌ 404 Not Found | The route api/v1/hr/employees could not  |
| RH Ponto | GET | `/api/v1/hr/clock-entries` | ❌ 404 Not Found | The route api/v1/hr/clock-entries could  |
| Qualidade | GET | `/api/v1/quality/procedures` | ✅ 200 OK | 0 registros |
| Automação | GET | `/api/v1/automation/rules` | ✅ 200 OK | 0 registros |
| IA Predições | GET | `/api/v1/ai/predictions` | ❌ 404 Not Found | The route api/v1/ai/predictions could no |

## Endpoints com Problemas

- ❌ **⭐ Comissões Dashboard** — `GET /api/v1/commission-dashboard` → 404 Not Found — The route api/v1/commission-dashboard could not be found.
- ❌ **⭐ Adiantamentos** — `GET /api/v1/technician-advances` → 404 Not Found — The route api/v1/technician-advances could not be found.
- ❌ **Email Contas** — `GET /api/v1/email/accounts` → 404 Not Found — The route api/v1/email/accounts could not be found.
- 💥 **Checklists** — `GET /api/v1/checklists` → 500 Server Error — Erro ao listar checklists
- ❌ **RH Funcionários** — `GET /api/v1/hr/employees` → 404 Not Found — The route api/v1/hr/employees could not be found.
- ❌ **RH Ponto** — `GET /api/v1/hr/clock-entries` → 404 Not Found — The route api/v1/hr/clock-entries could not be found.
- ❌ **IA Predições** — `GET /api/v1/ai/predictions` → 404 Not Found — The route api/v1/ai/predictions could not be found.