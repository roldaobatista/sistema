# Auditoria do Módulo Central

**Data:** 2026-02-17  
**Escopo:** Backend (Laravel), Frontend (React), permissões, dados e segurança.

---

## 1. Resumo executivo

O módulo Central (inbox unificado de tarefas, lembretes, OS, chamados etc.) foi auditado. Foram aplicadas **correções de segurança e consistência** e documentados os pontos verificados.

| Categoria        | Status   | Observação                                      |
|------------------|----------|-------------------------------------------------|
| Segurança        | Corrigido | Autorização por visibilidade em show/update/comment/assign |
| Validação API    | Corrigido | tipo/status/prioridade validados contra enums   |
| Consistência     | OK       | Normalização front (tipoKey/statusKey/prioridadeKey) |
| Permissões       | OK       | central.item.view, central.create.task, central.close.self, central.assign |
| Tenant           | OK       | BelongsToTenant + check.tenant no grupo de rotas |
| Migrations       | OK       | remind_notified_at com guards hasTable/hasColumn |

---

## 2. Backend

### 2.1 Controller (CentralController)

- **Rotas:** GET summary, constants, items, items/{id}; POST items, items/{id}/comments, items/{id}/assign; PATCH items/{id}. KPIs e regras em rotas separadas com permissões específicas.
- **Validação store:** `tipo` e `prioridade` validados contra enums (aceitam maiúsculas e minúsculas). `visibilidade` in PRIVADO,EQUIPE,EMPRESA.
- **Validação update:** `status` e `prioridade` validados contra enums (maiúsculas e minúsculas).
- **Autorização:** show, update, comment e assign passam a verificar `usuarioPodeAcessarItem()` (responsável, criador ou visibilidade EQUIPE/EMPRESA). Retorno 403 quando o usuário não pode acessar o item.
- **Assign:** usuário alvo validado com `exists:users,id` e mesmo `tenant_id`.

### 2.2 Service (CentralService)

- **listar:** Filtros por scope (minhas/todas), search, tipo, status, prioridade, responsavel_user_id, aba (hoje/atrasadas/sem_prazo). Ordenação: sem sort = prioridade (urgente primeiro) + due_at + created_at; sort_by prioridade com CASE; sort_by due_at/created_at/titulo com dir.
- **usuarioPodeAcessarItem:** Novo método: true se usuário é responsável, criador ou visibilidade EQUIPE/EMPRESA.
- **criar:** tenant_id e criado_por preenchidos; responsavel default = usuário; notificação ao atribuir a outro.
- **atualizar:** histórico de status, responsável e snooze; notificação ao reatribuir.
- **resumo:** Guard quando `user()?->id` é null (retorna zeros). Base em doUsuario($userId).

### 2.3 Model (CentralItem)

- **BelongsToTenant:** Scope global por `tenant_id`; preenchimento de `tenant_id` no creating.
- **Casts:** tipo, status, prioridade, visibilidade (enums); due_at, remind_at, remind_notified_at, snooze_until (datetime); contexto, tags (array).
- **Relacionamentos:** responsavel, criadoPor, closedBy, comments, history, source (morphTo).
- **Scopes:** atrasados, hoje, semPrazo, doUsuario, daEquipe.
- **gerarNotificacao:** Suporta opts (icon, color) para lembrete.

### 2.4 Comando SendCentralReminders

- Filtra itens com remind_at preenchido, remind_at <= now(), remind_notified_at null, status não concluído/cancelado.
- Notifica responsável e preenche remind_notified_at.
- Em CLI não há tenant no request; o scope de tenant não é aplicado, então processa todos os tenants (comportamento desejado para job agendado).

### 2.5 Migrations

- **remind_notified_at:** Adicionada com hasTable/hasColumn; down() com guards. Sem after() e sem default em JSON.

---

## 3. Frontend

### 3.1 CentralPage

- **Normalização:** tipoKey, statusKey, prioridadeKey mapeiam valores da API (UPPERCASE) para chaves do front (ex.: ORCAMENTO → orçamento, EM_ANDAMENTO → em_andamento).
- **tipoConfig:** Incluído tipo `outro` para itens com tipo OUTRO.
- **Resumo:** `summaryRes?.data?.data ?? summaryRes?.data` para aceitar resposta com ou sem wrapper.
- **Lista:** Paginação (page, per_page 20), erro com retry, empty state com botão "Criar primeira tarefa" (com permissão).
- **Filtros:** busca (debounce 300ms), tipo, prioridade, responsável, escopo (todas/só minhas), ordenação (prazo, prioridade, data criação) e direção.
- **Modal detalhe:** Link para origem (sourceLink), snooze (1h, amanhã, próxima semana, escolher data), reatribuir, comentários, histórico.
- **Modal criar:** Título dinâmico (Nova Tarefa / Novo Lembrete), botão Criar desabilitado sem título, campos com id/aria-label onde aplicável.

### 3.2 QuickReminderButton

- Exibido no header para quem tem `central.create.task`. POST /central/items com tipo lembrete, visibilidade privado.

### 3.3 Link de notificação

- Notificações da Central usam link `/central?item={id}`. CentralPage lê `?item=` e abre o modal do item, depois remove o parâmetro da URL.

---

## 4. Permissões

| Permissão             | Uso                                      |
|-----------------------|------------------------------------------|
| central.item.view     | Ver lista, summary, detalhe, comentários |
| central.create.task   | Criar itens (POST items) e ver botão Lembrete rápido |
| central.close.self    | Atualizar item (status, snooze, etc.)    |
| central.assign        | Reatribuir responsável                   |
| central.manage.kpis   | Dashboard / KPIs                         |
| central.manage.rules  | Regras de automação                      |

Todas as rotas da Central estão dentro do grupo com `auth:sanctum` e `check.tenant`.

---

## 5. Correções aplicadas nesta auditoria

1. **Validação store/update:** tipo, status e prioridade validados contra enums (valores em maiúsculas e minúsculas aceitos).
2. **Autorização:** show, update, comment e assign passam a usar `usuarioPodeAcessarItem()`; 403 para itens privados de outro usuário.
3. **resumo():** Retorno seguro quando não há usuário autenticado (zeros).
4. **Frontend:** tipoConfig com `outro`; remoção de imports não utilizados (ArrowRight, Pause, Filter, X).

---

## 6. Recomendações futuras

- **Testes:** Incluir testes de autorização (usuário A não acessa item privado do usuário B) e de validação de enums.
- **Auditoria de acesso:** Se necessário, registrar em log acessos a itens sensíveis (ex.: visibilidade privada).
- **Limite de comentários:** Implementado `body` com `max:2000` na validação do comment.
