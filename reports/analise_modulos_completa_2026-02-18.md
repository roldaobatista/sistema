# Analise Completa de Modulos - 2026-02-18

## Limitação importante
- `php artisan route:list --json` falha atualmente por DI no Fiscal (`App\Services\Fiscal\FiscalProvider` sem binding).
- Por isso, `backend/route-list.json` está potencialmente desatualizado (arquivo de 14/02/2026, enquanto `api.php` e `PermissionsSeeder.php` são de 18/02/2026).

## Backend (API)
- Rotas analisadas (route-list): 1150
- Modulos analisados: 156
- Rotas com permissão faltando no seeder: 7
- Rotas autenticadas sem check.permission: 32
- Rotas de mutacao usando apenas permissao .view: 81

### Permissões faltando no seeder (rotas detectadas)
| Modulo | Metodo | URI | Permissao |
|---|---|---|---|
| collection-rules | GET|HEAD | api/v1/collection-rules | finance.collection.view |
| collection-rules | POST | api/v1/collection-rules | finance.collection.manage |
| collection-rules | PUT | api/v1/collection-rules/{rule} | finance.collection.manage |
| cost-centers | POST | api/v1/cost-centers | finance.cost_center.manage |
| cost-centers | PUT | api/v1/cost-centers/{costCenter} | finance.cost_center.manage |
| cost-centers | DELETE | api/v1/cost-centers/{costCenter} | finance.cost_center.manage |
| route-plans | POST | api/v1/route-plans | route.plan.manage |

### Modulos com inconsistencias
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

## Frontend (rotas/telas)
- Rotas totais: 259
- Modulos de rota: 41
- Rotas protegidas: 202
- Rotas protegidas sem regra de permissao: 5
- Regras duplicadas: 1
- Permissoes usadas no frontend e ausentes no seeder: 2

### Rotas protegidas sem regra de permissão
| Path |
|---|
| / |
| /perfil |
| /calibracao/:calibrationId/leituras |
| /calibracao/templates |
| /tv/cameras |

### Regras duplicadas
| Match | Count | Permissions |
|---|---:|---|
| /rh/onboarding | 2 | hr.onboarding.view,hr.onboarding.view |

### Permissões do frontend ausentes no seeder
| Permissao |
|---|
| fiscal.config.manage |
| reports.analytics.view |

## Inventários completos
- Backend completo por modulo: `reports/analise_modulos_2026-02-18.md`
- Frontend modulos: `reports/frontend_modules_inventory_2026-02-18.json`
- Frontend permissoes/rotas: `reports/frontend_route_permission_audit_2026-02-18.json`
