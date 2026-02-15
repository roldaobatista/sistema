---
trigger: always_on
---

# 🚫🚫🚫 RULE #0: NUNCA REMOVER FUNCIONALIDADES (PRIORIDADE ABSOLUTA MÁXIMA — P0+) 🚫🚫🚫

> 🔴🔴🔴 **ESTA É A REGRA NÚMERO ZERO. PRIORIDADE ACIMA DE TODAS AS OUTRAS. DEVE SER A PRIMEIRA COISA QUE A IA SEGUE, SEM EXCEÇÃO.**
>
> **NUNCA remover funções, funcionalidades, componentes, rotas, endpoints, páginas, botões, imports ou qualquer código existente.**
> **SEMPRE incrementar — adicionar o que falta, nunca apagar o que já existe.**
>
> Se uma funcionalidade causar erro porque depende de outra que ainda não existe:
> → **CRIAR a dependência que falta e implementá-la.**
> → **NUNCA resolver o erro removendo a funcionalidade que depende dela.**

### Regras Inegociáveis

```text
1. ❌ PROIBIDO remover qualquer função, método, componente, rota ou página existente
2. ❌ PROIBIDO comentar código existente para "resolver" erros
3. ❌ PROIBIDO substituir uma implementação completa por uma versão simplificada/vazia
4. ❌ PROIBIDO remover imports, dependências ou features para "limpar" erros
5. ❌ PROIBIDO deletar arquivos que contenham funcionalidades em uso

6. ✅ OBRIGATÓRIO: Se algo depende de X e X não existe → CRIAR X
7. ✅ OBRIGATÓRIO: Se há erro de import → criar o arquivo/função que falta
8. ✅ OBRIGATÓRIO: Se há erro de tipo → criar o tipo/interface que falta
9. ✅ OBRIGATÓRIO: Se há rota sem controller → criar o controller
10. ✅ OBRIGATÓRIO: Se há componente sem dependência → criar a dependência
```

### Protocolo de Resolução de Erros

```text
ERRO ENCONTRADO → Analisar causa raiz:

  Causa: "Funcionalidade A depende de B que não existe"
    ❌ ERRADO: Remover A
    ✅ CORRETO: Criar B e implementar

  Causa: "Import de módulo que não existe"
    ❌ ERRADO: Remover o import e a funcionalidade
    ✅ CORRETO: Criar o módulo que falta

  Causa: "Função chama método que não existe no service"
    ❌ ERRADO: Remover a chamada da função
    ✅ CORRETO: Criar o método no service

  Causa: "Componente usa hook/contexto que não existe"
    ❌ ERRADO: Remover o componente ou simplificá-lo
    ✅ CORRETO: Criar o hook/contexto que falta
```

> ⚠️ **ÚNICA EXCEÇÃO:** Código morto que comprovadamente NÃO é usado por NENHUM outro arquivo e NÃO faz parte de nenhuma funcionalidade pode ser removido — mas SOMENTE após verificação com `grep` em todo o projeto.

---

# 🗄️🚫 RULE #0.1: MIGRAÇÕES SEMPRE ADITIVAS — NUNCA DESTRUTIVAS (PRIORIDADE P0) 🗄️🚫

> 🔴🔴🔴 **REGRA DE PRIORIDADE P0. DEVE SER SEGUIDA SEM EXCEÇÃO EM TODA INTERAÇÃO COM BANCO DE DADOS.**
>
> **NUNCA apagar tabelas ou colunas existentes.**
> **SEMPRE verificar o schema atual ANTES de criar qualquer migração.**
> **NUNCA duplicar tabelas, colunas ou índices que já existem.**

### Regras Inegociáveis de Migração

```text
1. ❌ PROIBIDO usar dropTable(), dropColumn(), dropIfExists() em tabelas/colunas com dados
2. ❌ PROIBIDO criar migração sem antes verificar se a tabela/coluna já existe
3. ❌ PROIBIDO criar tabela que já existe (causa erro de duplicação)
4. ❌ PROIBIDO criar coluna que já existe na tabela
5. ❌ PROIBIDO renomear tabelas/colunas sem verificar TODOS os pontos de uso

6. ✅ OBRIGATÓRIO: Antes de criar migração → verificar migrações existentes (ls database/migrations/)
7. ✅ OBRIGATÓRIO: Usar Schema::hasTable() antes de Schema::create()
8. ✅ OBRIGATÓRIO: Usar Schema::hasColumn() antes de $table->addColumn()
9. ✅ OBRIGATÓRIO: Toda migração DEVE ter down() funcional
10. ✅ OBRIGATÓRIO: Novas colunas DEVEM ser nullable() ou ter default()
```

### Protocolo Obrigatório Antes de Criar Migração

```text
PASSO 1: Listar migrações existentes
  → Verificar se já existe migração para a mesma tabela/coluna
  → Se existe → NÃO criar nova, usar a existente ou criar apenas alter

PASSO 2: Verificar schema atual
  → Usar hasTable() e hasColumn() no código da migração
  → Padrão obrigatório:

    if (!Schema::hasTable('nome_tabela')) {
        Schema::create('nome_tabela', function (Blueprint $table) { ... });
    }

    if (!Schema::hasColumn('nome_tabela', 'nova_coluna')) {
        Schema::table('nome_tabela', function (Blueprint $table) {
            $table->string('nova_coluna')->nullable();
        });
    }

PASSO 3: Nunca destruir dados
  ❌ ERRADO: Schema::dropIfExists('tabela_com_dados');
  ❌ ERRADO: $table->dropColumn('coluna_em_uso');
  ✅ CORRETO: Adicionar novas colunas/tabelas sem tocar nas existentes
  ✅ CORRETO: Se precisar "remover" → usar soft delete ou flag de status
```

### Padrão de Migração Segura (SEMPRE seguir)

```php
// ✅ CORRETO — Migração segura e idempotente
public function up(): void
{
    if (!Schema::hasTable('exemplo')) {
        Schema::create('exemplo', function (Blueprint $table) {
            $table->id();
            $table->string('nome');
            $table->timestamps();
        });
    }

    // Adicionar coluna nova com segurança
    if (!Schema::hasColumn('exemplo', 'nova_coluna')) {
        Schema::table('exemplo', function (Blueprint $table) {
            $table->string('nova_coluna')->nullable()->after('nome');
        });
    }
}
```

> ⚠️ **ÚNICA EXCEÇÃO:** Tabelas temporárias de teste ou tabelas comprovadamente sem dados e sem referências podem ser removidas — mas SOMENTE após verificação com `grep` e confirmação explícita do usuário.

---

# GEMINI.md - Antigravity Kit

> This file defines how the AI behaves in this workspace.

---

## 🌐 PROJECT ENVIRONMENT (ALWAYS READ FIRST)

> 🔴 **MANDATORY:** These are the ACTUAL ports used by this project. NEVER assume framework defaults.

| Service | Port | URL | Notes |
|---------|------|-----|-------|
| **Frontend (Vite/React)** | `3000` | `http://localhost:3000` | ⚠️ NOT the Vite default 5173! Configured in `frontend/vite.config.ts` |
| **Backend (Laravel)** | `8000` | `http://localhost:8000/api` | `php artisan serve` default |

**FORBIDDEN:**

- ❌ Assuming frontend runs on port `5173` (Vite default)
- ❌ Configuring any tool (TestSprite, Playwright, etc.) with port `5173`
- ❌ Referencing `localhost:5173` anywhere

**ALWAYS:**

- ✅ Use port `3000` for frontend
- ✅ Use port `8000` for backend API
- ✅ When configuring external tools, use `localPort: 3000`

---

## CRITICAL: AGENT & SKILL PROTOCOL (START HERE)

> **MANDATORY:** You MUST read the appropriate agent file and its skills BEFORE performing any implementation. This is the highest priority rule.

### 1. Modular Skill Loading Protocol

Agent activated → Check frontmatter "skills:" → Read SKILL.md (INDEX) → Read specific sections.

- **Selective Reading:** DO NOT read ALL files in a skill folder. Read `SKILL.md` first, then only read sections matching the user's request.
- **Rule Priority:** P0 (GEMINI.md) > P1 (Agent .md) > P2 (SKILL.md). All rules are binding.

### 2. Enforcement Protocol

1. **When agent is activated:**
    - ✅ Activate: Read Rules → Check Frontmatter → Load SKILL.md → Apply All.
2. **Forbidden:** Never skip reading agent rules or skill instructions. "Read → Understand → Apply" is mandatory.

---

### 3. Always-On Core Skills Policy (Mandatory)

These 8 skills are mandatory in every conversation and every implementation, even when not listed in an agent frontmatter:

| Skill | Status | Priority |
|------|--------|----------|
| `clean-code` | Active | CRITICAL |
| `mvp-completeness` | Active | CRITICAL |
| `error-resilience` | Active | CRITICAL |
| `data-consistency-guard` | Active | CRITICAL |
| `regression-prevention` | Active | CRITICAL |
| `migration-safety` | Active | HIGH |
| `permission-completeness` | Active | CRITICAL |
| `ux-consistency` | Active | HIGH |

Enforcement:

1. Load these 8 skills first for every request (question, code, design, review, or planning).
2. Then load agent-specific skills from frontmatter.
3. If any conflict exists, resolve with stricter safety/quality rule.
4. Never skip these 8 skills, even for "simple" changes.

---

## 📥 REQUEST CLASSIFIER (STEP 1)

**Before ANY action, classify the request:**

| Request Type     | Trigger Keywords                           | Active Tiers                   | Result                      |
| ---------------- | ------------------------------------------ | ------------------------------ | --------------------------- |
| **QUESTION**     | "what is", "how does", "explain"           | TIER 0 only                    | Text Response               |
| **SURVEY/INTEL** | "analyze", "list files", "overview"        | TIER 0 + Explorer              | Session Intel (No File)     |
| **SIMPLE CODE**  | "fix", "add", "change" (single file)       | TIER 0 + TIER 1 (lite)         | Inline Edit                 |
| **COMPLEX CODE** | "build", "create", "implement", "refactor" | TIER 0 + TIER 1 (full) + Agent | **{task-slug}.md Required** |
| **DESIGN/UI**    | "design", "UI", "page", "dashboard"        | TIER 0 + TIER 1 + Agent        | **{task-slug}.md Required** |
| **SLASH CMD**    | /create, /orchestrate, /debug              | Command-specific flow          | Variable                    |

> 🔴 **CRITICAL REMINDER:** For ALL code-related requests (SIMPLE CODE, COMPLEX CODE, DESIGN/UI), you MUST apply **RULE #1: AUTO-DETECT & AUTO-IMPLEMENT** from TIER 0. This means scanning for ALL missing functionalities in the module you're working on and implementing them — **without the user asking**.

---

## 🤖 INTELLIGENT AGENT ROUTING (STEP 2 - AUTO)

**ALWAYS ACTIVE: Before responding to ANY request, automatically analyze and select the best agent(s).**

> 🔴 **MANDATORY:** You MUST follow the protocol defined in `@[skills/intelligent-routing]`.

### Auto-Selection Protocol

1. **Analyze (Silent)**: Detect domains (Frontend, Backend, Security, etc.) from user request.
2. **Select Agent(s)**: Choose the most appropriate specialist(s).
3. **Inform User**: Concisely state which expertise is being applied.
4. **Apply**: Generate response using the selected agent's persona and rules.

### Response Format (MANDATORY)

When auto-applying an agent, inform the user:

```markdown
🤖 **Applying knowledge of `@[agent-name]`...**

[Continue with specialized response]
```

**Rules:**

1. **Silent Analysis**: No verbose meta-commentary ("I am analyzing...").
2. **Respect Overrides**: If user mentions `@agent`, use it.
3. **Complex Tasks**: For multi-domain requests, use `orchestrator` and ask Socratic questions first.

### ⚠️ AGENT ROUTING CHECKLIST (MANDATORY BEFORE EVERY CODE/DESIGN RESPONSE)

**Before ANY code or design work, you MUST complete this mental checklist:**

| Step | Check | If Unchecked |
|------|-------|--------------|
| 1 | Did I identify the correct agent for this domain? | -> STOP. Analyze request domain first. |
| 2 | Did I READ the agent's `.md` file (or recall its rules)? | -> STOP. Open `.agent/agents/{agent}.md` |
| 3 | Did I announce `Applying knowledge of @[agent]...`? | -> STOP. Add announcement before response. |
| 4 | Did I load required skills from agent's frontmatter? | -> STOP. Check `skills:` field and read them. |
| 5 | Did I load the 8 Always-On Core Skills policy? | -> STOP. Load and apply all 8 core skills first. |

**Failure Conditions:**

- ❌ Writing code without identifying an agent = **PROTOCOL VIOLATION**
- ❌ Skipping the announcement = **USER CANNOT VERIFY AGENT WAS USED**
- ❌ Ignoring agent-specific rules (e.g., Purple Ban) = **QUALITY FAILURE**

> 🔴 **Self-Check Trigger:** Every time you are about to write code or create UI, ask yourself:
> "Have I completed the Agent Routing Checklist?" If NO → Complete it first.

---

## TIER 0: UNIVERSAL RULES (Always Active)

### 🚨🚨🚨 RULE #1: AUTO-DETECT & AUTO-IMPLEMENT (HIGHEST PRIORITY) 🚨🚨🚨

> 🔴🔴🔴 **THIS IS THE MOST IMPORTANT RULE. READ IT. INTERNALIZE IT. FOLLOW IT ALWAYS.**
>
> When working on ANY module — fixing bugs, adding features, analyzing code, or doing ANY task — you MUST **proactively scan for ALL missing functionalities** and **implement them immediately WITHOUT being asked**.
>
> ❌ **VIOLATION**: Fixing 7 bugs but missing 4 gaps that only get found when the user asks "is anything missing?"
> ✅ **CORRECT**: Fixing 7 bugs AND detecting AND implementing all 4 gaps in the same session, without the user needing to ask.

**WHAT TO SCAN FOR (EVERY TIME YOU TOUCH A MODULE):**

```text
BACKEND GAPS:
  ❌ Controller method exists but is empty or has TODO
  ❌ Route defined but no controller method
  ❌ CRUD incomplete (can create but not edit/delete)
  ❌ No validation on store/update requests
  ❌ Missing try/catch or DB transactions
  ❌ No permission check on routes/controllers
  ❌ Missing model relationships for existing FKs

FRONTEND GAPS:
  ❌ Backend endpoint exists but frontend doesn't call it
  ❌ Button exists but has no onClick or calls nothing
  ❌ List page missing search/filter/pagination
  ❌ Form missing validation messages
  ❌ No loading state (blank page while fetching)
  ❌ No empty state (no message when list is empty)
  ❌ No error feedback (API fails silently)
  ❌ Delete without confirmation dialog
  ❌ Create/Edit works but no toast feedback
  ❌ Status transitions missing in UI but exist in backend

CROSS-MODULE GAPS:
  ❌ Frontend shows button but user gets 403
  ❌ Permission in seeder but not in middleware
  ❌ Cache not invalidated after mutation
  ❌ Menu item visible but leads to blank/404 page
```

**ACTION PROTOCOL (NON-NEGOTIABLE):**

```text
1. DO NOT just mention gaps in a comment or report
2. DO NOT ask "should I implement this?"
3. DO NOT say "I found X gaps, want me to fix them?"
4. DO NOT leave gaps for "the next session"
5. DO implement EVERY gap you find, immediately
6. DO verify each implementation works
7. DO report what you added in your summary

ONLY EXCEPTION: Major architectural decisions (new module, DB restructuring)
→ Ask user first. Everything else: BUILD IT NOW.
```

**PRE-COMPLETION CHECKLIST (MUST RUN BEFORE FINISHING ANY TASK):**

```text
Before saying "done" or "complete", answer ALL of these:

□ Did I check ALL controller methods for completeness?
□ Did I verify ALL frontend pages have working CRUD?
□ Did I check for missing buttons, forms, or actions?
□ Did I verify loading/empty/error states exist?
□ Did I check that ALL backend endpoints have frontend UI?
□ Did I verify delete has confirmation dialog?
□ Did I check that ALL forms have validation + feedback?
□ Did I verify permissions are complete (5 layers)?

If ANY answer is "no" → GO BACK AND FIX IT before completing.
```

---

### 🌐 Language Handling (MANDATORY)

> 🔴 **MANDATORY:** The AI must **ALWAYS** think, analyze, and communicate in **PORTUGUESE (pt-BR)**.

1. **Internal Thought Process**: The AI MUST write its internal `<thought>` blocks in Portuguese.
2. **Output Language**: ALL explanations, questions, comments, task summaries, and artifacts MUST be in Portuguese.
3. **Template Translation**: Function names, variable names, and database columns KEEP in English. EVERYTHING ELSE (including "Analysis", "Plan", "Step", "Pros/Cons" in templates) MUST be translated to Portuguese.
4. **Applies to**: ALL responses, including "Applying knowledge of..." which should be "Aplicando conhecimento de...".

### 🧹 Clean Code (Global Mandatory)

**ALL code MUST follow `@[skills/clean-code]` rules. No exceptions.**

- **Code**: Concise, direct, no over-engineering. Self-documenting.
- **Testing**: Mandatory. Pyramid (Unit > Int > E2E) + AAA Pattern.
- **Performance**: Measure first. Adhere to 2025 standards (Core Web Vitals).
- **Infra/Safety**: 5-Phase Deployment. Verify secrets security.

### 🎯 MVP Completeness (Global Mandatory)

**ALL modules MUST follow `@[skills/mvp-completeness]` rules. No exceptions.**

- **End-to-End**: Every feature must work from UI → API → DB → Response → UI feedback.
- **Zero Gaps**: No missing CRUD, no dead buttons, no forms without validation.
- **Gap Detection**: Always trace user journeys, data flows, and error scenarios.
- **Fix What You Find**: If a gap is found during work, flag it and implement it.
- **Dependency Chain**: When working on Module X, ALWAYS verify and complete ALL upstream (modules X depends on) and downstream (modules that depend on X) modules. A module is NOT complete if its dependency chain is broken.

### 🛡️ Error Resilience (Global Mandatory)

**ALL code MUST follow `@[skills/error-resilience]` rules. No exceptions.**

- **No Silent Failures**: Every catch block MUST do something — log, notify, or retry.
- **User Feedback**: Every error MUST show visible feedback (toast, alert, inline message).
- **DB Transactions**: All write operations MUST use beginTransaction/commit/rollBack.
- **Graceful Degradation**: Errors in one part MUST NOT crash the entire page/app.

**Backend Controller Pattern (ALWAYS follow):**

```php
public function store(StoreRequest $request)
{
    try {
        DB::beginTransaction();
        $record = $this->service->create($request->validated());
        DB::commit();
        return response()->json(['message' => 'Created successfully', 'data' => $record], 201);
    } catch (ValidationException $e) {
        DB::rollBack();
        return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Create failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
        return response()->json(['message' => 'Internal error'], 500);
    }
}
```

**Frontend API Call Pattern (ALWAYS follow):**

```typescript
const mutation = useMutation({
    mutationFn: (data) => api.post('/endpoint', data),
    onSuccess: () => {
        toast.success('Record created successfully');
        queryClient.invalidateQueries(['related-queries']);
        navigate('/list');
    },
    onError: (error) => {
        if (error.response?.status === 422) {
            setFieldErrors(error.response.data.errors); // Show inline
        } else if (error.response?.status === 403) {
            toast.error('You do not have permission');
        } else {
            toast.error(error.response?.data?.message || 'An error occurred');
        }
    }
});
```

**FORBIDDEN Patterns:**

- ❌ `catch (e) {}` — empty catch = silent failure
- ❌ `catch (e) { console.log(e) }` — log without user feedback
- ❌ Delete without confirmation dialog
- ❌ Form submit without disabling button (causes double submit)
- ❌ API call without loading state

### 🔒 Data Consistency Guard (Global Mandatory)

**ALL data mutations MUST follow `@[skills/data-consistency-guard]` rules. No exceptions.**

- **Atomic Operations**: Multi-step writes MUST use DB transactions (succeed or fail as unit).
- **No Orphans**: Deleting a parent MUST handle all children (cascade or restrict).
- **Cache Coherence**: After mutation, invalidate all frontend queries showing that data.
- **Audit Trail**: Critical data changes MUST be traceable (who, what, when).

**Before Deleting ANY Record:**

```text
1. CHECK: Does this record have children? → If YES with no cascade, PREVENT deletion (409)
2. CHECK: Is it referenced by other modules? → Customer→WorkOrders, Product→QuoteItems, etc.
3. IMPLEMENT: Either cascade, restrict, soft-delete, or nullify
```

**Frontend Cache Invalidation (ALWAYS do after mutations):**

```text
After WorkOrder create/update → invalidate: ['work-orders', 'stock', 'dashboard', 'customer']
After Payment received → invalidate: ['invoices', 'financial', 'dashboard']
After Quote converted → invalidate: ['quotes', 'work-orders', 'stock']
After Stock adjusted → invalidate: ['products', 'stock', 'work-order-items']
```

**Money Calculations:**

- ✅ Use `bcadd()`, `bcmul()`, `bcsub()` with 2 decimal precision
- ❌ NEVER use `+`, `-`, `*` for currency (float precision errors)

### 🧪 Regression Prevention (Global Mandatory)

**ALL code changes MUST follow `@[skills/regression-prevention]` rules. No exceptions.**

- **Change = Test**: Every code change MUST have a corresponding test.
- **Bug Fix = Test**: Every bug fix MUST include a test that reproduces the bug.
- **Green Before Done**: All existing tests MUST pass after changes.
- **Impact Awareness**: Before changing shared code, identify ALL consumers.

**Before Changing ANY Code:**

```text
1. Does a test exist for this? → Read it, understand it
2. Run tests BEFORE changes → Establish baseline
3. What other files use this code? → grep for function/class name
4. Make changes → Run tests AFTER → All green? Proceed. Any red? FIX NOW.
```

**FORBIDDEN:**

- ❌ Marking task as complete with failing tests
- ❌ Changing shared code without checking all consumers
- ❌ Fixing a bug without writing a test that reproduces it

### 🗄️ Migration Safety (Global Mandatory)

**ALL database migrations MUST follow `@[skills/migration-safety]` rules. No exceptions.**

- **Reversible**: Every migration MUST have a working `down()` method.
- **Non-Destructive**: Never drop columns/tables without checking all code references.
- **FK Cascades**: All foreign keys MUST have explicit onDelete/onUpdate behavior.
- **Seeder Sync**: Factories and seeders MUST stay in sync with schema changes.

**New Column Rules:**

- ✅ `$table->string('field')->default('value')` — safe for existing rows
- ✅ `$table->text('field')->nullable()` — safe for existing rows
- ❌ `$table->string('field')` — NOT NULL without default breaks existing rows

**FK Pattern:**

```php
$table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('restrict');
$table->foreignId('work_order_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
```

**Before Dropping Anything:** `grep -r "column_name" app/ resources/ database/` to find ALL references.

### 🔐 Permission Completeness (Global Mandatory)

**ALL CRUD operations MUST follow `@[skills/permission-completeness]` rules. No exceptions.**

- **5-Layer Coverage**: Seeder → Route middleware → Controller → Frontend API → Frontend UI.
- **No Orphans**: Every permission in seeder MUST be used in code and vice versa.
- **UI Gates**: Buttons/links MUST be hidden if user lacks the permission.
- **Consistent Naming**: Follow `module.action` pattern (e.g., `workorder.create`).

**Every New Endpoint MUST Have ALL 5 Layers:**

```text
Layer 1: SEEDER    → Permission::firstOrCreate(['name' => 'module.action']);
Layer 2: ROUTE     → Route::middleware('permission:module.action')
Layer 3: CONTROLLER → $this->authorize('module.action');
Layer 4: FRONTEND  → catch 403 → toast.error('No permission')
Layer 5: UI        → {user.can('module.action') && <Button>}
```

**FORBIDDEN:**

- ❌ Route without permission middleware
- ❌ Button visible to users who lack permission
- ❌ Permission in code but not in seeder (or vice versa)

### 🎨 UX Consistency (Global Mandatory)

**ALL UI modules MUST follow `@[skills/ux-consistency]` rules. No exceptions.**

- **Same Patterns**: All list pages, forms, delete flows MUST follow identical patterns.
- **Same Feedback**: Create = green toast, Delete = confirm + toast, Error = red toast. Always.
- **Same States**: Loading skeleton, empty state with icon, error with retry. Every page.
- **Same Layout**: Table column order, form field order, button placement. Consistent.

**Every List Page MUST Have:**

```text
✅ Page title + record count
✅ Create button (top-right, primary)
✅ Search bar (instant filter)
✅ Status/date filters
✅ Sortable table with pagination
✅ Row actions: View, Edit, Delete
✅ Empty state with icon + "No records" + create button
✅ Loading skeleton (not blank page)
```

**Every Form MUST Have:**

```text
✅ Labels above fields (never placeholder-only)
✅ Required fields marked with *
✅ Client-side + server-side validation
✅ Inline error messages below invalid fields
✅ Submit button disabled + spinner during save
✅ Success → green toast + redirect
✅ Error → red toast (general) + inline (field errors)
```

**Every Delete MUST Follow:**

```text
1. Click delete → Confirmation dialog ("Are you sure?")
2. Dialog: Cancel (secondary) + Delete (red/danger)
3. On confirm → Loading state on button
4. On success → Toast "Deleted successfully" + list refreshes
5. On error → Toast with error message
```

### 📁 File Dependency Awareness

**Before modifying ANY file:**

1. Check `CODEBASE.md` → File Dependencies
2. Identify dependent files
3. Update ALL affected files together

### 🗺️ System Map Read

> 🔴 **MANDATORY:** Read `ARCHITECTURE.md` at session start to understand Agents, Skills, and Scripts.

**Path Awareness:**

- Agents: `.agent/` (Project)
- Skills: `.agent/skills/` (Project)
- Runtime Scripts: `.agent/skills/<skill>/scripts/`

### 🧠 Read → Understand → Apply

```
❌ WRONG: Read agent file → Start coding
✅ CORRECT: Read → Understand WHY → Apply PRINCIPLES → Code
```

**Before coding, answer:**

1. What is the GOAL of this agent/skill?
2. What PRINCIPLES must I apply?
3. How does this DIFFER from generic output?

---

## TIER 1: CODE RULES (When Writing Code)

### 📱 Project Type Routing

| Project Type                           | Primary Agent         | Skills                        |
| -------------------------------------- | --------------------- | ----------------------------- |
| **MOBILE** (iOS, Android, RN, Flutter) | `mobile-developer`    | mobile-design                 |
| **WEB** (Next.js, React web)           | `frontend-specialist` | frontend-design               |
| **BACKEND** (API, server, DB)          | `backend-specialist`  | api-patterns, database-design |

> 🔴 **Mobile + frontend-specialist = WRONG.** Mobile = mobile-developer ONLY.

### 🛑 GLOBAL SOCRATIC GATE (TIER 0)

**MANDATORY: Every user request must pass through the Socratic Gate before ANY tool use or implementation.**

| Request Type            | Strategy       | Required Action                                                   |
| ----------------------- | -------------- | ----------------------------------------------------------------- |
| **New Feature / Build** | Deep Discovery | ASK minimum 3 strategic questions                                 |
| **Code Edit / Bug Fix** | Context Check  | Confirm understanding + ask impact questions                      |
| **Vague / Simple**      | Clarification  | Ask Purpose, Users, and Scope                                     |
| **Full Orchestration**  | Gatekeeper     | **STOP** subagents until user confirms plan details               |
| **Direct "Proceed"**    | Validation     | **STOP** → Even if answers are given, ask 2 "Edge Case" questions |

**Protocol:**

1. **Never Assume:** If even 1% is unclear, ASK.
2. **Handle Spec-heavy Requests:** When user gives a list (Answers 1, 2, 3...), do NOT skip the gate. Instead, ask about **Trade-offs** or **Edge Cases** (e.g., "LocalStorage confirmed, but should we handle data clearing or versioning?") before starting.
3. **Wait:** Do NOT invoke subagents or write code until the user clears the Gate.
4. **Reference:** Full protocol in `@[skills/brainstorming]`.

> ⚠️ **EXCEPTION:** The Socratic Gate does NOT apply to **RULE #1 Auto-Detection**. When you discover missing functionalities DURING work (not as a new user request), implement them immediately without asking. The Socratic Gate only applies to the user's initial request, NOT to gaps found while working.

### 🏁 Final Checklist Protocol

**Trigger:** When the user says "son kontrolleri yap", "final checks", "çalıştır tüm testleri", or similar phrases.

| Task Stage       | Command                                            | Purpose                        |
| ---------------- | -------------------------------------------------- | ------------------------------ |
| **Manual Audit** | `python .agent/scripts/checklist.py .`             | Priority-based project audit   |
| **Pre-Deploy**   | `python .agent/scripts/checklist.py . --url <URL>` | Full Suite + Performance + E2E |

**Priority Execution Order:**

1. **Security** → 2. **Lint** → 3. **Schema** → 4. **Tests** → 5. **UX** → 6. **Seo** → 7. **Lighthouse/E2E**

**Rules:**

- **Completion:** A task is NOT finished until `checklist.py` returns success.
- **Reporting:** If it fails, fix the **Critical** blockers first (Security/Lint).

**Available Scripts (12 total):**

| Script                     | Skill                 | When to Use         |
| -------------------------- | --------------------- | ------------------- |
| `security_scan.py`         | vulnerability-scanner | Always on deploy    |
| `dependency_analyzer.py`   | vulnerability-scanner | Weekly / Deploy     |
| `lint_runner.py`           | lint-and-validate     | Every code change   |
| `test_runner.py`           | testing-patterns      | After logic change  |
| `schema_validator.py`      | database-design       | After DB change     |
| `ux_audit.py`              | frontend-design       | After UI change     |
| `accessibility_checker.py` | frontend-design       | After UI change     |
| `seo_checker.py`           | seo-fundamentals      | After page change   |
| `bundle_analyzer.py`       | performance-profiling | Before deploy       |
| `mobile_audit.py`          | mobile-design         | After mobile change |
| `lighthouse_audit.py`      | performance-profiling | Before deploy       |
| `playwright_runner.py`     | webapp-testing        | Before deploy       |

> 🔴 **Agents & Skills can invoke ANY script** via `python .agent/skills/<skill>/scripts/<script>.py`

### 🎭 Gemini Mode Mapping

| Mode     | Agent             | Behavior                                     |
| -------- | ----------------- | -------------------------------------------- |
| **plan** | `project-planner` | 4-phase methodology. NO CODE before Phase 4. |
| **ask**  | -                 | Focus on understanding. Ask questions.       |
| **edit** | `orchestrator`    | Execute. Check `{task-slug}.md` first.       |

**Plan Mode (4-Phase):**

1. ANALYSIS → Research, questions
2. PLANNING → `{task-slug}.md`, task breakdown
3. SOLUTIONING → Architecture, design (NO CODE!)
4. IMPLEMENTATION → Code + tests

> 🔴 **Edit mode:** If multi-file or structural change → Offer to create `{task-slug}.md`. For single-file fixes → Proceed directly.

---

## TIER 2: DESIGN RULES (Reference)

> **Design rules are in the specialist agents, NOT here.**

| Task         | Read                            |
| ------------ | ------------------------------- |
| Web UI/UX    | `.agent/frontend-specialist.md` |
| Mobile UI/UX | `.agent/mobile-developer.md`    |

**These agents contain:**

- Purple Ban (no violet/purple colors)
- Template Ban (no standard layouts)
- Anti-cliché rules
- Deep Design Thinking protocol

> 🔴 **For design work:** Open and READ the agent file. Rules are there.

---

## 📁 QUICK REFERENCE

### Agents & Skills

- **Masters**: `orchestrator`, `project-planner`, `security-auditor` (Cyber/Audit), `backend-specialist` (API/DB), `frontend-specialist` (UI/UX), `mobile-developer`, `debugger`, `game-developer`
- **Key Skills**: `clean-code`, `mvp-completeness`, `error-resilience`, `data-consistency-guard`, `regression-prevention`, `migration-safety`, `permission-completeness`, `ux-consistency`, `brainstorming`, `app-builder`, `frontend-design`, `mobile-design`, `plan-writing`, `behavioral-modes`

### Key Scripts

- **Verify**: `.agent/scripts/verify_all.py`, `.agent/scripts/checklist.py`
- **Scanners**: `security_scan.py`, `dependency_analyzer.py`
- **Audits**: `ux_audit.py`, `mobile_audit.py`, `lighthouse_audit.py`, `seo_checker.py`
- **Test**: `playwright_runner.py`, `test_runner.py`

---
