# AGENTS.md

## Language Handling (MANDATORY)

1. Output language: todas as respostas da IA devem ser em Portugues (pt-BR).
2. Codigo: nomes tecnicos (variaveis, funcoes, classes, colunas) em Ingles.
3. Regra vale para tudo: explicacoes, perguntas, comentarios, resumo final e mensagens de progresso.

## Modos de Trabalho (OBRIGATORIO)

### CONSULTA
- Usar quando o usuario pedir analise, explicacao, revisao ou levantamento.
- Nao editar codigo, exceto se o usuario pedir explicitamente.

### IMPLEMENTACAO (padrao)
- Usar quando o usuario pedir correcao, melhoria ou nova funcionalidade.
- Implementar fim a fim com validacao minima necessaria.

### PRODUCAO
- Usar quando o pedido envolver deploy, migration em producao, servidor, rollback, backup ou hotfix em ambiente real.
- Seguir estritamente `.cursor/rules/deploy-production.mdc` e `.cursor/rules/migration-production.mdc`.

## Skills Instaladas

- `%USERPROFILE%/.codex/skills/clean-code/SKILL.md`
- `%USERPROFILE%/.codex/skills/mvp-completeness/SKILL.md`
- `%USERPROFILE%/.codex/skills/error-resilience/SKILL.md`
- `%USERPROFILE%/.codex/skills/data-consistency-guard/SKILL.md`
- `%USERPROFILE%/.codex/skills/regression-prevention/SKILL.md`
- `%USERPROFILE%/.codex/skills/migration-safety/SKILL.md`
- `%USERPROFILE%/.codex/skills/permission-completeness/SKILL.md`
- `%USERPROFILE%/.codex/skills/ux-consistency/SKILL.md`

## Politica de Ativacao de Skills

### Base (sempre ativas)
1. clean-code
2. error-resilience
3. regression-prevention

### Condicionais (ativar quando aplicavel)
4. mvp-completeness: modulo novo, fluxo incompleto ou entrega E2E
5. data-consistency-guard: mutacao de dados, transacoes, cache, auditoria, orfaos
6. permission-completeness: CRUD, auth, middleware, roteamento, gate frontend
7. migration-safety: qualquer alteracao de schema/migration/seeder de estrutura
8. ux-consistency: telas, formularios, tabelas, feedback visual/interacoes

Se alguma skill obrigatoria para o contexto estiver ausente ou ilegivel, parar e reportar exatamente qual falhou.

## Autonomia da IA com Seguranca (OBRIGATORIO)

- A IA deve corrigir automaticamente problemas relacionados encontrados durante a tarefa.
- A IA nao deve limitar mudancas apenas ao minimo textual quando houver risco tecnico claro.
- A IA deve pedir confirmacao antes de acoes de alto risco:
  1. acao destrutiva em banco/infra/producao
  2. alteracao sensivel de autenticacao/permissao global
  3. migration com risco de perda de dados
  4. operacao irreversivel fora do escopo original

## Gate Final Obrigatorio (simples para usuario nao tecnico)

Antes da resposta final, apresentar sempre estes 4 itens:
1. O que mudou
2. Risco (baixo/medio/alto e motivo)
3. Como validar rapido
4. Como desfazer (rollback)

## Fonte Unica de Verdade para Producao

- Em caso de conflito entre este AGENTS e regras de producao, prevalece:
  1. `.cursor/rules/deploy-production.mdc`
  2. `.cursor/rules/migration-production.mdc`

## Producao e Deploy (OBRIGATORIO)

### Servidor de Producao
- IP: `178.156.176.145`
- SSH: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@178.156.176.145`
- Diretorio: `/root/sistema`
- URL principal: `http://178.156.176.145`
- Banco: MySQL 8.0, database `kalibrium`, user `kalibrium`

### NUNCA perguntar ao usuario
- Onde esta o servidor
- Qual chave SSH usar
- Qual compose file usar
- Se deve fazer backup (sempre fazer antes de alteracao em producao)

## Politica de Migration em Producao (resumo)

- NUNCA usar `->after()` em migration nova.
- NUNCA usar `->default()` em coluna JSON.
- Usar `hasColumn`/`hasTable` quando houver alteracao incremental.
- Nome curto para indice composto quando houver risco de exceder 64 caracteres.
- Atualizar `composer.lock` ao adicionar pacote.

### Regra de Legado (OBRIGATORIA)
- Se a migration legado ja rodou em producao: nao editar arquivo antigo; criar migration corretiva nova, idempotente e reversivel.
- Se a migration legado ainda nao rodou em producao: pode corrigir o arquivo diretamente.
- NUNCA usar `migrate:fresh` ou `migrate:reset` em producao.

## Safety Rule For Skill Origin

Nao deletar skills originais do caminho:
- `c:/Users/Roldao testes/projetos/sistema/.agent/skills`

Politica obrigatoria: copy-only.
