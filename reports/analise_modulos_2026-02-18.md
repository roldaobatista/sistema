# Analise de Modulos - 2026-02-18

## Resumo
- Total de rotas API: 1150
- Total de modulos API: 156
- Rotas com permissao ausente no seeder: 7
- Rotas autenticadas sem check.permission: 32
- Rotas de mutacao usando somente permissao .view: 81

## Modulos com inconsistencias
| Modulo | Rotas | Seeder ausente | Auth sem permissao | Mutacao com .view |
|---|---:|---:|---:|---:|
| asset-tags | 5 | 0 | 0 | 3 |
| audit-logs | 5 | 0 | 0 | 1 |
| batches | 5 | 0 | 0 | 3 |
| batch-export | 3 | 0 | 0 | 2 |
| central | 15 | 0 | 0 | 1 |
| collection-rules | 3 | 3 | 0 | 0 |
| cost-centers | 4 | 3 | 0 | 0 |
| crm-advanced | 12 | 0 | 0 | 5 |
| emails | 19 | 0 | 0 | 6 |
| external | 7 | 0 | 7 | 0 |
| financial | 20 | 0 | 0 | 7 |
| financial-extra | 6 | 0 | 0 | 4 |
| hr | 97 | 0 | 1 | 0 |
| inventories | 6 | 0 | 0 | 4 |
| lab-advanced | 12 | 0 | 0 | 7 |
| logout | 1 | 0 | 1 | 0 |
| material-requests | 4 | 0 | 0 | 2 |
| me | 1 | 0 | 1 | 0 |
| my-tenants | 1 | 0 | 1 | 0 |
| operational | 4 | 0 | 0 | 1 |
| pixel | 1 | 0 | 1 | 0 |
| portal | 29 | 0 | 7 | 0 |
| products | 12 | 0 | 0 | 2 |
| profile | 3 | 0 | 3 | 0 |
| purchase-quotes | 5 | 0 | 0 | 3 |
| push | 4 | 0 | 3 | 0 |
| reconciliation-rules | 7 | 0 | 0 | 1 |
| reports | 14 | 0 | 1 | 0 |
| rma | 4 | 0 | 0 | 2 |
| route-plans | 2 | 1 | 0 | 0 |
| service-checklists | 5 | 0 | 0 | 3 |
| sla-policies | 5 | 0 | 0 | 3 |
| stock | 19 | 0 | 0 | 4 |
| stock-advanced | 19 | 0 | 0 | 11 |
| stock-disposals | 4 | 0 | 0 | 2 |
| switch-tenant | 1 | 0 | 1 | 0 |
| tech | 4 | 0 | 3 | 0 |
| technicians | 3 | 0 | 0 | 1 |
| tv | 1 | 0 | 1 | 0 |
| user | 1 | 0 | 1 | 0 |
| warehouses | 6 | 0 | 0 | 3 |

## Inventario completo de modulos
| Modulo | Status | Rotas |
|---|---|---:|
| account-payable-categories | OK | 4 |
| accounts-payable | OK | 6 |
| accounts-payable-categories | OK | 4 |
| accounts-payable-summary | OK | 1 |
| accounts-receivable | OK | 8 |
| accounts-receivable-summary | OK | 1 |
| advanced | OK | 15 |
| ai | OK | 15 |
| asset-tags | ALERTA | 5 |
| audit-logs | ALERTA | 5 |
| automation | OK | 16 |
| auvo | OK | 13 |
| bank-accounts | OK | 5 |
| bank-reconciliation | OK | 16 |
| batches | ALERTA | 5 |
| batch-export | ALERTA | 3 |
| branches | OK | 5 |
| cash-flow | OK | 2 |
| central | ALERTA | 15 |
| chart-of-accounts | OK | 4 |
| checklists | OK | 5 |
| checklist-submissions | OK | 3 |
| collection-rules | ALERTA | 3 |
| commission-calculation-types | OK | 1 |
| commission-campaigns | OK | 4 |
| commission-dashboard | OK | 5 |
| commission-disputes | OK | 5 |
| commission-events | OK | 7 |
| commission-goals | OK | 5 |
| commission-rules | OK | 5 |
| commission-settlements | OK | 7 |
| commission-simulate | OK | 1 |
| commission-statement | OK | 1 |
| commission-summary | OK | 1 |
| cost-centers | ALERTA | 4 |
| crm | OK | 31 |
| crm-advanced | ALERTA | 12 |
| customer-documents | OK | 1 |
| customers | OK | 11 |
| dashboard-stats | OK | 1 |
| dre | OK | 1 |
| email-accounts | OK | 7 |
| email-notes | OK | 1 |
| email-rules | OK | 6 |
| emails | ALERTA | 19 |
| email-signatures | OK | 4 |
| email-tags | OK | 4 |
| email-templates | OK | 5 |
| equipment-documents | OK | 1 |
| equipments | OK | 10 |
| equipments-alerts | OK | 1 |
| equipments-constants | OK | 1 |
| equipments-dashboard | OK | 1 |
| equipments-export | OK | 1 |
| expense-analytics | OK | 1 |
| expense-categories | OK | 4 |
| expenses | OK | 10 |
| expenses-export | OK | 1 |
| expense-summary | OK | 1 |
| external | ALERTA | 7 |
| financial | ALERTA | 20 |
| financial-extra | ALERTA | 6 |
| fiscal | OK | 7 |
| fleet | OK | 57 |
| fleet-advanced | OK | 5 |
| fueling-logs | OK | 6 |
| fund-transfers | OK | 5 |
| hr | ALERTA | 97 |
| hr-advanced | OK | 5 |
| import | OK | 14 |
| import-entity-counts | OK | 1 |
| import-stats | OK | 1 |
| inmetro | OK | 97 |
| innovation | OK | 7 |
| integrations | OK | 18 |
| inventories | ALERTA | 6 |
| inventory | OK | 14 |
| invoices | OK | 6 |
| lab-advanced | ALERTA | 12 |
| login | OK | 1 |
| logout | ALERTA | 1 |
| material-requests | ALERTA | 4 |
| me | ALERTA | 1 |
| mobile | OK | 18 |
| my-tenants | ALERTA | 1 |
| notifications | OK | 4 |
| numbering-sequences | OK | 3 |
| operational | ALERTA | 4 |
| parts-kits | OK | 5 |
| payment-methods | OK | 4 |
| payments | OK | 2 |
| payments-summary | OK | 1 |
| permissions | OK | 3 |
| pixel | ALERTA | 1 |
| portal | ALERTA | 29 |
| price-history | OK | 1 |
| product-categories | OK | 4 |
| products | ALERTA | 12 |
| profile | ALERTA | 3 |
| purchase-quotes | ALERTA | 5 |
| push | ALERTA | 4 |
| quality | OK | 18 |
| quote-equipments | OK | 2 |
| quote-items | OK | 2 |
| quote-photos | OK | 1 |
| quotes | OK | 18 |
| quotes-export | OK | 1 |
| quotes-summary | OK | 1 |
| reconciliation-rules | ALERTA | 7 |
| recurring-commissions | OK | 6 |
| recurring-contracts | OK | 6 |
| reports | ALERTA | 14 |
| rma | ALERTA | 4 |
| roles | OK | 7 |
| route-plans | ALERTA | 2 |
| sales | OK | 6 |
| schedules | OK | 8 |
| schedules-unified | OK | 1 |
| security | OK | 20 |
| service-calls | OK | 12 |
| service-calls-agenda | OK | 1 |
| service-calls-assignees | OK | 1 |
| service-calls-export | OK | 1 |
| service-calls-map | OK | 1 |
| service-calls-summary | OK | 1 |
| service-categories | OK | 4 |
| service-checklists | ALERTA | 5 |
| services | OK | 6 |
| settings | OK | 2 |
| sla-dashboard | OK | 3 |
| sla-policies | ALERTA | 5 |
| standard-weights | OK | 8 |
| stock | ALERTA | 19 |
| stock-advanced | ALERTA | 19 |
| stock-disposals | ALERTA | 4 |
| suppliers | OK | 5 |
| switch-tenant | ALERTA | 1 |
| tech | ALERTA | 4 |
| technician | OK | 2 |
| technician-cash | OK | 4 |
| technician-cash-summary | OK | 1 |
| technicians | ALERTA | 3 |
| tenants | OK | 7 |
| tenants-stats | OK | 1 |
| time-entries | OK | 6 |
| time-entries-summary | OK | 1 |
| tools | OK | 4 |
| tv | ALERTA | 1 |
| user | ALERTA | 1 |
| users | OK | 15 |
| warehouses | ALERTA | 6 |
| warehouse-stocks | OK | 1 |
| work-orders | OK | 26 |
| work-orders-dashboard-stats | OK | 1 |
| work-orders-export | OK | 1 |
| work-orders-metadata | OK | 1 |

## Rotas com permissao faltando no seeder
| Modulo | Metodo | URI | Permissao faltando |
|---|---|---|---|
| collection-rules | GET|HEAD | api/v1/collection-rules | finance.collection.view |
| collection-rules | POST | api/v1/collection-rules | finance.collection.manage |
| collection-rules | PUT | api/v1/collection-rules/{rule} | finance.collection.manage |
| cost-centers | POST | api/v1/cost-centers | finance.cost_center.manage |
| cost-centers | PUT | api/v1/cost-centers/{costCenter} | finance.cost_center.manage |
| cost-centers | DELETE | api/v1/cost-centers/{costCenter} | finance.cost_center.manage |
| route-plans | POST | api/v1/route-plans | route.plan.manage |
