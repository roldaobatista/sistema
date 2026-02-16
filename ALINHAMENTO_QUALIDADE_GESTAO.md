# Alinhamento: Gestão da Qualidade e Competência Técnica

> Objetivo: trabalhar conforme boas práticas de gestão da qualidade e de laboratório, para futura adaptação formal, **sem referenciar normas no sistema**.

---

## 1. O que já existe e está alinhado

| Área | O que o sistema já tem | Observação |
|------|------------------------|------------|
| **Procedimentos** | `quality_procedures`: código, revisão, aprovação, data de próxima revisão, status (rascunho/ativo/obsoleto), categorias (calibração, segurança, operacional, gestão) | Controle de documentos técnicos e operacionais |
| **Documentos versionados** | `document_versions`: código, versão, categoria (procedimento, instrução, formulário, registro, política, manual), aprovação, vigência e data de revisão | Controle de documentos da qualidade |
| **Ações corretivas e preventivas** | `corrective_actions`: tipo (corretiva/preventiva), origem (calibração, reclamação, auditoria, interno), descrição da não conformidade, causa raiz, plano de ação, responsável, prazo, verificação de eficácia | Vinculação por morph (reclamação, calibração, etc.) |
| **CAPA** | `capa_records`: tipo, origem (NPS, reclamação, auditoria, retrabalho, manual), causa raiz, ações, verificação, eficácia | Complementar ao corrective_actions |
| **Reclamações** | `customer_complaints`: cliente, OS, equipamento, descrição, categoria, severidade, status, resolução, responsável | Fluxo aberto → investigação → resolvido/fechado |
| **Pesquisa de satisfação / NPS** | `satisfaction_surveys`: NPS, notas de serviço/técnico/pontualidade, comentário, canal | Dashboard NPS no módulo Qualidade |
| **Auditorias internas** | `quality_audits` + `quality_audit_items`: número, tipo (interna/externa/fornecedor), escopo, data planejada/executada, auditor, itens com requisito, cláusula, pergunta, resultado (conforme/não conforme/observação), evidência, totais de NC e observações | Planejamento e registro de auditorias |
| **Calibração – rastreabilidade** | `equipment_calibrations`: data, próximo vencimento, tipo, resultado, laboratório, número do certificado, padrão utilizado, incerteza, erros, condições ambientais, método, declaração de conformidade, EPM/erro encontrado | Suporte a rastreabilidade e incerteza |
| **Leituras de calibração** | `calibration_readings`: valor de referência, indicação (crescente/decrescente), erro, incerteza expandida, fator k, correção, ordem | Dados técnicos para certificado e rastreabilidade |
| **Não conformidade na calibração** | Colunas `has_nonconformity` e `nonconformity_details` em `equipment_calibrations` | Registro de calibração não conforme |
| **Treinamentos (RH)** | Módulo RH: treinamentos, vencimentos, dashboard de pendências | Competência e reciclagem |
| **Registro de auditoria (log)** | Audit log do sistema (ações de usuário) | Rastreabilidade de alterações |

---

## 2. O que precisa ser ajustado ou criado

### 2.1 Nomenclatura e interface (sem citar normas)

- **Feito:** Remover “ISO” dos títulos e subtítulos do módulo Qualidade (ex.: “Auditorias Internas”, “Documentos da Qualidade”), mantendo a mesma funcionalidade.

### 2.2 Controle de documentos

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Anexo do documento | `document_versions.file_path` existe, mas não há fluxo claro de upload no front | Garantir upload de arquivo ao criar/editar documento e exibir link/download na listagem e no detalhe |
| Obsoletar versão anterior | Backend já marca como obsoleto ao aprovar nova versão do mesmo código | Verificar se a listagem filtra/exibe “versão vigente” e histórico de versões por código |
| Distribuição / acesso | Não há registro de “quem recebeu qual versão” | Opcional: tabela de distribuição (documento_id, user_id, data) para evidência de divulgação |

### 2.3 Auditorias internas

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Status da auditoria | Existe `planned`; no item existe `result` (conform/non_conform/observation) | Incluir status da auditoria: “em andamento”, “concluída”, “cancelada” e preencher `executed_date` ao concluir |
| Auditor: seleção por nome | Hoje o formulário pede “ID do auditor” | Trocar por select de usuários (lista de usuários com permissão de auditor ou todos do tenant) |
| Ligar NC da auditoria → ação corretiva | Itens com resultado “não conforme” não geram automaticamente ação corretiva | Permitir “Abrir ação corretiva” a partir do item de auditoria (origem = auditoria, sourceable = quality_audit_item ou quality_audit) |
| Plano de ações de acompanhamento | Não há tela de “plano de ações” da auditoria | Opcional: listar ações corretivas com origem “auditoria” vinculadas àquela auditoria |

### 2.4 Reclamações e ações corretivas

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Reclamação → ação corretiva | Model já tem relação; CorrectiveAction aceita sourceable | Na tela de reclamação, botão “Abrir ação corretiva” criando registro com source = complaint, sourceable = CustomerComplaint |
| Prazo para resposta à reclamação | Não há campo “prazo de resposta” ou “respondido em” | Opcional: `response_due_at`, `responded_at` em `customer_complaints` para acompanhamento de prazos |

### 2.5 Revisão pela direção (management review)

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Reuniões de revisão | Não existe módulo específico | Criar entidade “Revisão pela direção” (data, participantes, pauta, decisões, ações). Pode ser uma tabela simples + tela de listagem/cadastro e vinculação de “ações” (responsável, prazo, status) |
| Entradas típicas | — | Usar dados já existentes: NPS, reclamações abertas/fechadas, ações corretivas em atraso, auditorias do período, procedimentos com revisão vencida, indicadores do dashboard de qualidade |

### 2.6 Calibração e laboratório

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Incerteza no certificado | `uncertainty` e leituras com `expanded_uncertainty` e `k_factor` existem | Garantir que o certificado PDF e a tela de resultado exibam incerteza de forma clara e consistente |
| Condições ambientais | `temperature`, `humidity`, `pressure` em `equipment_calibrations` | Garantir preenchimento na execução e exibição no certificado/relatório |
| Rastreabilidade de padrões | `standard_weights` vinculados à calibração | Manter e reforçar na tela e no certificado qual padrão foi usado (identificação única) |
| Competência do executante | `performed_by` e `approved_by` existem | Opcional: link para treinamentos/habilitações do usuário (ex.: “habilitado para calibração de balanças”) |

### 2.7 Registros e evidências

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Retenção de registros | Não há política configurável no sistema | Opcional: configuração por tipo (ex.: “calibrações: 5 anos”, “reclamações: 3 anos”) e relatório de “registros próximos ao vencimento” para arquivamento/descarte |
| Imutabilidade após fechamento | Ordens de serviço e calibrações podem ser editadas após conclusão | Avaliar: após “fechado”/aprovado, apenas correções com registro de motivo (audit trail) ou bloqueio de edição de campos críticos |

### 2.8 Permissões e rotas

| Item | Situação | Ação sugerida |
|------|----------|----------------|
| Auditorias e documentos (API) | Rotas `quality-audits` e `iso-documents` usam middleware `qualidade.procedure.view` | Alinhar com o front: usar `quality.audit.view` / `quality.document.view` (e create/update) nas rotas de auditorias e documentos, para consistência com o PermissionsSeeder |

---

## 3. Priorização sugerida (MVP)

1. **Nomenclatura:** Remover “ISO” dos labels (Auditorias, Documentos da Qualidade).  
2. **Auditorias:** Status “concluída” + data de execução; seleção de auditor por nome; opção “Abrir ação corretiva” a partir de item não conforme.  
3. **Reclamações:** Botão “Abrir ação corretiva” na reclamação.  
4. **Documentos:** Garantir upload e download do arquivo em Documentos da Qualidade.  
5. **API:** Ajustar middlewares de `quality-audits` e `iso-documents` para usar permissões `quality.audit.*` e `quality.document.*`.  

Depois, conforme necessidade:

- Revisão pela direção (cadastro de reuniões + decisões/ações).  
- Reclamações: prazos de resposta.  
- Política de retenção de registros (configuração + relatório).

---

## 4. Resumo

O sistema já cobre **procedimentos, documentos versionados, ações corretivas/preventivas, reclamações, NPS, auditorias internas, calibração com rastreabilidade e incerteza, não conformidade na calibração e treinamentos**. Para trabalhar conforme as boas práticas sem citar normas, as mudanças principais são: **nomenclatura sem “ISO”**, **fluxos completos** (reclamação → ação corretiva; auditoria → ação corretiva), **auditoria com status e executor claro**, **documento com arquivo anexo** e **opcionalmente revisão pela direção e alinhamento de permissões**.
