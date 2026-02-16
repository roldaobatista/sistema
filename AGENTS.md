# AGENTS.md

## 🌐 Language Handling (MANDATORY)

> 🔴 **MANDATORY:** The AI must **ALWAYS** communicate in **PORTUGUESE (pt-BR)**, regardless of the user's input language.

1. **Output Language**: ALL explanations, questions, comments, and task summaries MUST be in Portuguese.
2. **Code**: Variable names, function names, and database columns MUST be in English (standard practice).
3. **Applies to**: ALL responses, including "Applying knowledge of..." and other template messages.

## Mandatory Always-On Skills

The following skills are mandatory in every turn and must be auto-applied without explicit user mention.

1. clean-code (CRITICAL)
2. mvp-completeness (CRITICAL)
3. error-resilience (CRITICAL)
4. data-consistency-guard (CRITICAL)
5. regression-prevention (CRITICAL)
6. migration-safety (HIGH)
7. permission-completeness (CRITICAL)
8. ux-consistency (HIGH)

## Installed Skill Paths

All mandatory skills are installed in Codex home and must be loaded from:

- C:/Users/Roldão testes/.codex/skills/clean-code/SKILL.md
- C:/Users/Roldão testes/.codex/skills/mvp-completeness/SKILL.md
- C:/Users/Roldão testes/.codex/skills/error-resilience/SKILL.md
- C:/Users/Roldão testes/.codex/skills/data-consistency-guard/SKILL.md
- C:/Users/Roldão testes/.codex/skills/regression-prevention/SKILL.md
- C:/Users/Roldão testes/.codex/skills/migration-safety/SKILL.md
- C:/Users/Roldão testes/.codex/skills/permission-completeness/SKILL.md
- C:/Users/Roldão testes/.codex/skills/ux-consistency/SKILL.md

## Trigger Rules (Mandatory)

- Apply all 8 skills on every task by default.
- Skills persist across turns; do not require re-mention.
- Do not ask whether to activate these skills; activation is implicit.
- If any mandatory skill is missing or unreadable, stop and report exactly which skill failed.

## Execution Priority

Use this fixed order:

1. clean-code
2. mvp-completeness
3. error-resilience
4. data-consistency-guard
5. regression-prevention
6. permission-completeness
7. migration-safety
8. ux-consistency

## Completion Gate (Required Before Final Answer)

Before completing any task, verify and confirm:

- Code quality and simplicity preserved (clean-code)
- End-to-end flow is complete for touched module(s) (mvp-completeness)
- Error handling and fallback paths exist (error-resilience)
- Data integrity is preserved and validated (data-consistency-guard)
- No behavior regressions introduced (regression-prevention)
- Migration changes are safe and reversible when applicable (migration-safety)
- Permission coverage is complete across backend and frontend when applicable (permission-completeness)
- UX behavior stays consistent with existing patterns (ux-consistency)

## Safety Rule For Skill Origin

Do not delete original skills from project-local path:

- c:/Users/Roldão testes/projetos/sistema/.agent/skills
Copy-only policy is mandatory.

## Produção e Deploy (OBRIGATÓRIO)

O sistema está em produção. A IA DEVE saber essas informações SEM perguntar ao usuário:

### Servidor de Produção
- **IP:** 178.156.176.145
- **SSH:** `ssh -i "$env:USERPROFILE\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@178.156.176.145`
- **Diretório:** /root/sistema
- **Stack:** Docker Compose (docker-compose.prod-http.yml)
- **URL:** http://178.156.176.145
- **Banco:** MySQL 8.0, database `kalibrium`, user `kalibrium`
- **SSL:** Ainda NÃO configurado (HTTP only). Quando configurar, usar docker-compose.prod.yml

### Como fazer deploy
Ler a regra completa em `.cursor/rules/deploy-production.mdc`. Resumo:
1. Commitar mudanças locais
2. Push para GitHub
3. Backup .env do servidor
4. `git fetch` + `git reset --hard origin/main` no servidor
5. Restaurar .env
6. Build Docker + up -d
7. Migrations + seeders + cache
8. Health check

### NUNCA perguntar ao usuário
- Onde está o servidor (IP: 178.156.176.145)
- Qual chave SSH usar (~/.ssh/id_ed25519)
- Qual compose file usar (docker-compose.prod-http.yml)
- Qual e-mail para SSL (já não é necessário, SSL não configurado ainda)
- Se deve fazer backup (SEMPRE fazer antes de qualquer mudança)

### Regras de migrations para produção
Ler `.cursor/rules/migration-production.mdc`. Resumo:
- NUNCA usar `->after()` em migrations
- NUNCA usar `->default()` em colunas JSON
- Sempre dar nome curto a índices compostos (< 64 chars)
- Sempre usar `hasColumn`/`hasTable` guards
- Sempre atualizar `composer.lock` se adicionar pacote
