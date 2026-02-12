# AGENTS.md

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

