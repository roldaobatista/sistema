# Relatório de Análise de Código — Sistema Kalibrium

> Análise profunda por módulo, arquivo e linha de código para identificação de erros e inconsistências.  
> Data: 16/02/2025 | Critérios: AGENTS.md, error-resilience, data-consistency-guard, permission-completeness, migration-safety.

---

## Resumo Executivo

| Categoria                | Crítico | Alto | Médio | Baixo |
|--------------------------|---------|------|-------|-------|
| Migrations               | 2       | 1    | 2     | 0     |
| Error handling (Backend) | 1       | 3    | 5+    | 0     |
| Error handling (Frontend)| 0       | 2    | 3     | 1     |
| Permissões               | 0       | 1    | 0     | 0     |
| Inconsistências gerais   | 0       | 0    | 2     | 0     |

---

## 1. Migrations (migration-production.mdc)

### 1.1 Uso de `->after()` — CRÍTICO

**Regra:** NUNCA usar `->after('coluna')` em migrations. Pode falhar em produção se a coluna de referência não existir.

**Ocorrências (arquivos de migração):**

| Arquivo | Linhas (exemplos) |
|---------|-------------------|
| `2026_02_16_100000_create_crm_features_tables.php` | 354-367 |
| `2026_02_13_300001_enhance_bank_reconciliation.php` | 13, 20 |
| `2026_02_11_200000_add_resolution_and_comments_to_service_calls.php` | 12 |
| `2026_02_14_100000_add_lead_source_to_quotes_and_work_orders.php` | 15, 21 |
| `2026_02_14_040000_create_crm_advanced_tables.php` | 64-65 |
| `2026_02_14_003636_add_advanced_fleet_fields_to_vehicles_table.php` | 16-31 |
| `2026_02_14_003838_add_parent_id_to_work_orders_table.php` | 15-16 |
| `2026_02_14_002829_add_warehouse_to_stock_movements_table.php` | 15-18 |
| `2026_02_14_002828_add_stock_options_to_products_table.php` | 15-18 |
| `2026_02_13_230535_add_location_and_status_to_users_table.php` | 15-20 |
| `2026_02_14_200000_create_hr_advanced_tables.php` | 17-28 |
| `2026_02_13_170000_inmetro_v3_50features.php` | 13-28 |
| `2026_02_14_160001_add_audit_fields_to_bank_statement_entries.php` | 12-17 |
| `2026_02_13_140000_resolve_system_gaps_batch1.php` | 24-115 |
| `2026_02_13_150000_fix_missing_columns_from_tests.php` | 18-47 |
| `2026_02_13_150000_inmetro_v2_expansion.php` | 19-36 |
| ... e várias outras (ver grep `->after(`) |

**Ação:** Remover todos os `->after()` das migrations. As colunas serão adicionadas ao final da tabela; o comportamento funcional não muda.

### 1.2 Empty catch em migration — CRÍTICO

**Arquivo:** `backend/database/migrations/2026_02_14_300000_add_remaining_module_permissions.php` (linha 159)

```php
try { $role->givePermissionTo($perm); } catch (\Exception $e) {}
```

**Problema:** Catch vazio viola error-resilience. Falhas na atribuição de permissão passam silenciosamente.

**Ação:** Registrar o erro com `Log::warning()` e, se necessário, permitir que a migration continue com mensagem informativa.

### 1.3 Índices compostos sem nome explícito — ALTO

**Regra:** MySQL limita nomes de índice a 64 caracteres. Laravel gera `{tabela}_{col1}_{col2}_index`. Tabelas/colunas longas podem exceder o limite.

**Migrations com índices sem nome explícito (potencial risco):**

- `create_system_improvements_tables.php`: `['tenant_id','searchable_type','searchable_id']` em `search_index`
- `create_crm_features_tables.php`: múltiplos índices compostos sem nome
- `create_lab_advanced_tables.php`: `['tenant_id','sensor_id','reading_at']`
- `create_tool_checkouts_table.php`: `['tenant_id','tool_id','checked_in_at']`
- `create_price_histories_table.php`: `['priceable_type','priceable_id','created_at']`

**Ação:** Dar nome explícito curto (< 64 chars) a todos os índices compostos em tabelas com nomes ou colunas longas.

### 1.4 JSON com default — OK

Não foram encontradas colunas JSON com `->default()`. Conforme regras, o uso está correto.

---

## 2. Error Handling — Backend (error-resilience)

### 2.1 Empty catch — CRÍTICO

| Local | Problema |
|-------|----------|
| `2026_02_14_300000_add_remaining_module_permissions.php:159` | `catch (\Exception $e) {}` em seeder de permissões |

### 2.2 Controllers sem try/catch em store/update/destroy — ALTO

Vários controllers fazem operações de escrita sem try/catch ou sem DB::transaction:

| Controller | Métodos |
|------------|---------|
| `ProductController` | `update()` — sem try/catch, sem transaction |
| `EquipmentModelController` | `store`, `update`, `destroy` |
| `EquipmentController` | `store`, `update`, `destroy` (usa transaction em store, verificar update/destroy) |
| `EquipmentModelController` | store/update/destroy |
| `InventoryController` | store |
| `CatalogController` | store/update/destroy |
| `ManagementReviewController` | store/update/destroy |
| `CameraController` | store/update/destroy |
| `InmetroController` | update/destroy |
| `RecurringContractController` | store/update/destroy |
| `StockTransferController` | store |
| `Technician\TimeEntryController` | store/update/destroy |
| `Technician\ScheduleController` | store/update/destroy |
| `Iam\RoleController` | store/update/destroy |
| `Iam\UserController` | store/update/destroy |
| `CommissionDisputeController` | store/destroy |
| `CommissionCampaignController` | store/update/destroy |
| `Master\CustomerController` | store/update/destroy |
| `ReconciliationRuleController` | store/update/destroy |
| `ReconciliationRuleController` | destroy (tem try/catch) |
| `SettingsController` | update |
| `ChartOfAccountController` | update/destroy (store tem try) |

**Padrão esperado:** try/catch + DB::transaction em operações de escrita; Log::error com contexto; retorno de mensagem amigável ao usuário.

### 2.3 Transações — OK

Há uso adequado de `DB::transaction` em vários controllers (WorkOrderController, QuoteController, ServiceCallController, ExpenseController, AccountReceivableController, etc.). O problema é a inconsistência: nem todos os controllers seguem o padrão.

---

## 3. Error Handling — Frontend (error-resilience)

### 3.1 Catch vazio em index.html — BAIXO

**Arquivo:** `frontend/index.html` linha 22

```javascript
try { if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark'); } catch(e) {}
```

**Contexto:** Evita FOUC ao aplicar tema antes do primeiro paint. Falha pode ocorrer em modo privado (localStorage indisponível). É um caso em que falhar silenciosamente é intencional, mas a skill proíbe qualquer catch vazio.

**Recomendação:** Manter comportamento, mas documentar. Alternativa: envolver em função que retorna boolean e ignora erro.

### 3.2 console.error sem feedback ao usuário — MÉDIO

Alguns componentes fazem `console.error` sem `toast.error` ou mensagem visível:

| Arquivo | Contexto |
|---------|----------|
| `ChecklistForm.tsx:177` | Erro em operação — verificar se há toast |
| `ChecklistBuilder.tsx:60` | Erro em operação — verificar se há toast |
| `TechnicianMap.tsx:107` | Erro em busca de localização |
| `AdminChatTab.tsx:81` | Falha ao enviar mensagem |
| `AuditTrailTab.tsx:67` | Falha ao buscar audit trail |
| `asyncselect.tsx:75` | Erro ao buscar opções |
| `usePushNotifications.ts` | Erros de push (95, 116, 126) |

**Ação:** Garantir que, além do `console.error`, exista feedback ao usuário (toast, mensagem inline ou estado de erro com retry).

### 3.3 Error Boundaries — OK

`ErrorBoundary`, `TechErrorBoundary` e `TvSectionBoundary` usam `console.error` para log e exibem fallback UI. Comportamento adequado.

---

## 4. Permissões (permission-completeness)

### 4.1 Qualidade — API já alinhada

As rotas `quality-audits` e `iso-documents` usam corretamente:

- `quality.audit.view`, `quality.audit.create`, `quality.audit.update`
- `quality.document.view`, `quality.document.create`, `quality.document.approve`

O `ALINHAMENTO_QUALIDADE_GESTAO.md` indica que usavam `qualidade.procedure.view`; isso já foi corrigido nas rotas.

### 4.2 Lacunas de permissão — ALTO

- **quality.document.update:** Não existe no PermissionsSeeder. As rotas de documento não expõem PUT; só create, approve e upload. Se o frontend permitir editar documento sem aprovar nova versão, falta fluxo e permissão.
- **quality.audit.delete:** Não existe. Não há rota DELETE para auditorias. Pode ser intencional (auditorias não são excluídas).
- **iso-documents:** Falta rota PUT para edição de documento. Verificar se o MVP exige edição de documento ou apenas nova versão + aprovação.

---

## 5. Data Consistency (data-consistency-guard)

### 5.1 Delete com verificação de dependências — OK

Vários controllers verificam dependências antes de excluir (ProductController, CustomerController, WorkOrderController, etc.).

### 5.2 Uso de transações — Parcial

Muitos controllers usam `DB::transaction`. Outros ainda não. Recomenda-se padronizar para operações multi-etapa.

---

## 6. Inconsistências e Melhorias Gerais

### 6.1 ProductController::update

- Não usa try/catch
- Não usa DB::transaction
- Em caso de erro, a exceção sobe sem tratamento e o usuário recebe resposta 500 genérica

### 6.2 Nomenclatura no menu (patch)

O `frontend-fixes.patch` e `frontend-fixes-unix.patch` referem "Auditorias ISO" e "Documentos ISO". O `ALINHAMENTO_QUALIDADE_GESTAO.md` recomenda remover "ISO" dos labels. O `AppLayout.tsx` atual usa "Auditorias Internas" e "Documentos da Qualidade" — correto.

---

## 7. Priorização de Correções

### Fase 1 — Crítico (antes de deploy)

1. Remover `->after()` de todas as migrations que ainda não foram aplicadas em produção (ou criar migrations de correção).
2. Corrigir empty catch em `2026_02_14_300000_add_remaining_module_permissions.php`.

### Fase 2 — Alto

3. Padronizar error handling nos controllers: try/catch + transaction em store/update/destroy.
4. Revisar índices compostos longos e adicionar nomes explícitos onde necessário.
5. Confirmar e, se necessário, implementar permissão/rota para edição de documentos (quality.document.update).

### Fase 3 — Médio

6. Frontend: garantir toast/mensagem de erro em todos os catches que hoje só fazem `console.error`.
7. Documentar decisão sobre catch em `index.html` para tema dark.

---

## 8. Arquivos Analisados (resumo)

- **Backend:** Controllers API V1, migrations, seeders, rotas
- **Frontend:** Páginas, componentes, hooks
- **Regras:** AGENTS.md, migration-production.mdc, deploy-production.mdc, skills (error-resilience, data-consistency-guard, permission-completeness)

---

## 9. Conclusão

O sistema está bem estruturado e segue, em grande parte, as regras definidas. Os pontos críticos concentram-se em:

1. Migrations com `->after()` (risco em produção)
2. Empty catch em migration de permissões
3. Inconsistência no tratamento de erros em controllers
4. Alguns componentes de frontend sem feedback de erro adequado

Recomenda-se aplicar as correções da Fase 1 antes de qualquer deploy em produção.

---

## 10. Correções Aplicadas (16/02/2025)

| Item | Status |
|------|--------|
| Empty catch em `2026_02_14_300000_add_remaining_module_permissions.php` | Corrigido — Log::warning adicionado |
| Remoção de `->after()` em todas as migrations | Corrigido — 40+ migrations atualizadas |
| ProductController::update sem try/catch | Corrigido — transaction + Log + resposta 500 |
| AsyncSelect sem feedback de erro ao usuário | Corrigido — toast.error adicionado |
| index.html catch vazio no tema dark | Corrigido — comentário explicativo |
| EquipmentModelController store/update/destroy | Corrigido — try/catch + DB::transaction + Log |
| ManagementReviewController store/update/destroy/storeAction/updateAction | Corrigido — try/catch + Log |
| CatalogController store/update/destroy | Corrigido — try/catch + Log |
| add_tenant_id_to_roles empty catch | Corrigido — Log::warning adicionado |
| AdminChatTab send/upload sem toast | Corrigido — toast.error adicionado |
| AuditTrailTab fetch sem toast | Corrigido — toast.error adicionado |
| EquipmentController::update | Corrigido — try/catch + Log |
| ScheduleController store/update | Corrigido — try/catch + Log |
| CentralController::update | Corrigido — try/catch + Log |
| TimeEntryController store/update | Corrigido — try/catch + Log |
| InmetroController destroy (msg raw) | Corrigido — mensagem amigável |
| CustomerController destroy indent | Corrigido — indentação |
| usePushNotifications subscribe/unsubscribe/sendTest | Corrigido — toast.error |
| InventoryController store (msg raw) | Corrigido — não expor exceção |
| CommissionDisputeController::resolve | Corrigido — try/catch no transaction |
