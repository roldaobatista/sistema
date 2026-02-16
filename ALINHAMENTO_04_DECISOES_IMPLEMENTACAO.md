# Documento de Alinhamento — Parte 4: Decisões Técnicas, TV, Integrações e Gaps

> Continuação de `ALINHAMENTO_03_FINANCEIRO.md`

---

## 15. Registro de TODAS as Decisões Tomadas

> Esta seção é o log completo de cada decisão tomada durante as conversas de alinhamento.
> **REGRA:** Este documento é sempre ADITIVO. Para alterar algo, deve-se perguntar primeiro e registrar "ANTES" e "DEPOIS".

### Decisões de Infraestrutura e Deploy

| # | Decisão | Data | Detalhe |
|---|---------|------|---------|
| D-01 | Hospedagem | 13/02 | Inicialmente HostGator com cPanel (compartilhada). Pode migrar se necessário |
| D-02 | Banco de dados | 13/02 | MySQL inicialmente no cPanel. Migração para VPS/cloud se necessário |
| D-03 | E-mail corporativo | 13/02 | Titan (fornecido pela HostGator). Sem necessidade de migrar no momento |
| D-04 | Usuários estimados | 13/02 | 10 a 50 usuários simultâneos |
| D-05 | Deploy com Docker | 15/02 | Dockerfile + docker-compose para frontend e backend. Nginx como proxy reverso |

### Decisões de Perfis e Permissões

| # | Decisão | Data | Antes | Depois |
|---|---------|------|-------|--------|
| D-10 | Nomes de perfis | 15/02 | Nomes em inglês (technician, driver) | **Nomes em português** (Técnico, Motorista) com coluna `display_name` |
| D-11 | Múltiplos perfis | 15/02 | 1 perfil por usuário | **Múltiplos perfis** com soma de permissões |
| D-12 | Remoção individual | 15/02 | Não existia | Possível **remover permissão específica** de um usuário |
| D-13 | Role Monitor | 15/02 | Não existia | Criado para acesso ao **Dashboard TV e câmeras** |
| D-14 | Perfil Coordenador | 15/02 | Não existia | Criado para gestão operacional + RH |

### Decisões do Módulo OS (Ordem de Serviço)

| # | Decisão | Data | Antes | Depois |
|---|---------|------|-------|--------|
| D-20 | Tipo de serviço | 15/02 | Não definido | **Serviço em campo** (técnico vai ao cliente) é o principal |
| D-21 | Equipe por OS | 15/02 | Não definido | **Varia** — pode ser solo, dupla (técnico+motorista), ou equipe |
| D-22 | Vendedor na OS | 15/02 | Não definido | **Misto** — às vezes tem vendedor, às vezes não. Campo opcional |
| D-23 | Deslocamento | 15/02 | Campo opcional | **Sempre cobra** — valor fixo ou por km |
| D-24 | Materiais | 15/02 | Não definido | **Às vezes nosso, às vezes do cliente** |
| D-25 | Fluxo da OS | 15/02 | Não definido | **Misto** — OS direta, via orçamento, via chamado OU contrato. Depende do cliente |
| D-26 | Motorista | 15/02 | Não definido | **Às vezes** — depende se é calibração rodoviária |
| D-27 | OS de garantia | 15/02 | Sem flag | Campo `is_warranty` (boolean). Quando marcado: **não gera comissão** |
| D-28 | Desconto e comissão | 15/02 | Não definido | **Sim** — comissão é sobre o valor COM desconto (valor real cobrado) |
| D-29 | OS cancelada | 15/02 | Sem estorno automático | **Despesas ficam**, **comissão estorna automaticamente** |

### Decisões de Despesas

| # | Decisão | Data | Antes | Depois |
|---|---------|------|-------|--------|
| D-30 | Quem gera despesas | 15/02 | Não definido | **Ambos** — técnico em campo e escritório |
| D-31 | Tipos comuns | 15/02 | Sem categorias | **Todas**: combustível, alimentação, peças, pedágio, hospedagem, ferramentas |
| D-32 | Categorias no seeder | 15/02 | Sem seeder | **10 categorias** criadas automaticamente com defaults de `affects_net_value` e `affects_technician_cash` |
| D-33 | `default_affects_net_value` | 15/02 | Campo não existia | **Adicionado** na tabela `expense_categories` — serve como padrão ao criar despesa |
| D-34 | `default_affects_technician_cash` | 15/02 | Campo não existia | **Adicionado** na tabela `expense_categories` — serve como padrão |
| D-35 | Caixa do técnico | 15/02 | Saldo único | **Dois saldos**: dinheiro (`balance`) + cartão corporativo (`card_balance`) |
| D-36 | `payment_method` | 15/02 | Campo não existia | **Adicionado** nas transações: `cash` ou `corporate_card` |
| D-37 | Fluxo de aprovação | 15/02 | Não definido | Técnico gasta → **Alessandra confere** → **Roldão aprova** |
| D-38 | Recarga do caixa | 15/02 | Não definido | Quando precisa, admin analisa e encaminha para aprovação |

### Decisões de Comissões

| # | Decisão | Data | Antes | Depois |
|---|---------|------|-------|--------|
| D-40 | Modelo de remuneração | 15/02 | Não definido | **Variado** — cada técnico tem sua própria regra e tipo |
| D-41 | Base de cálculo | 15/02 | Limitado | **Todos os tipos** (10+ calculation_types) disponíveis |
| D-42 | Percentual | 15/02 | Não definido | **Variável** por técnico/regra |
| D-43 | Comissão de vendedor | 15/02 | Não definido | **Todas as opções** configuráveis (%, fixo, meta) |
| D-44 | Quando libera | 15/02 | Não definido | **Fechamento mensal** das parcelas já pagas pelo cliente |
| D-45 | Divisão entre técnicos | 15/02 | Não definido | Cada um recebe **metade** da sua regra específica |
| D-46 | Fechamento mensal | 15/02 | Não definido | **Início do mês seguinte** (dia 1-5) |
| D-47 | Garantia | 15/02 | Não definido | **Não paga** comissão |
| D-48 | Cancelamento | 15/02 | Sem estorno | Comissão **estorna**, despesas **ficam** |
| D-49 | Despesas x comissão | 15/02 | Genérico | **Configurável** caso a caso — `affects_net_value` na despesa |
| D-50 | Flexibilidade futura | 15/02 | — | Regra de comissão controla tudo: bruto, líquido, menos peças, menos deslocamento, etc. Tudo via `calculation_type` |
| D-51 | Relatórios | 15/02 | Não definido | **Todos os 4**: extrato comissão, despesas/OS, lucratividade/OS, caixa técnico |

---

## 16. Módulo TV / Dashboard de Monitoramento

### Decisões (15/02)

| # | Decisão | Data | Detalhe |
|---|---------|------|---------|
| D-60 | Câmeras | 15/02 | 6 câmeras IP PoE (Intelbras) |
| D-61 | Layout | 15/02 | 6 câmeras à esquerda (grid 3×2) + mapa e KPIs à direita |
| D-62 | Interação | 15/02 | Grid grande, clicar em câmera para ampliar (modal) |
| D-63 | Role | 15/02 | "Monitor" — acesso ao dashboard TV e câmeras |
| D-64 | Centro do mapa | 15/02 | Rondonópolis, MT (coordenadas: -16.4673, -54.6353) |
| D-65 | Multi-tenancy | 15/02 | Câmeras filtradas por tenant (`tenant_id` na tabela cameras) |
| D-66 | Permissões | 15/02 | `tv.dashboard.view` e `tv.camera.manage` |

### Localização das Câmeras

| # | Local | Tipo | Modelo sugerido |
|---|-------|------|----------------|
| 1 | Frente (entrada) | Bullet (externa) | Intelbras VIP 1230 B G4 |
| 2 | Recepção | Dome (interna) | Intelbras VIP 1230 D G4 |
| 3 | Escritório | Dome (interna) | Intelbras VIP 1230 D G4 |
| 4 | Oficina 1 | Dome (interna) | Intelbras VIP 1230 D G4 |
| 5 | Oficina 2 | Dome (interna) | Intelbras VIP 1230 D G4 |
| 6 | Fundo (saída) | Bullet (externa) | Intelbras VIP 1230 B G4 |

### Infraestrutura de Câmeras

| Equipamento | Modelo | Qtd | Estimativa |
|---|---|---|---|
| NVR | Intelbras NVD 1408 P (8ch PoE) | 1 | R$ 1.200–1.500 |
| Câmera Bullet | Intelbras VIP 1230 B G4 | 2 | R$ 300–400 cada |
| Câmera Dome | Intelbras VIP 1230 D G4 | 4 | R$ 250–350 cada |
| HD | Seagate SkyHawk 1TB | 1 | R$ 350–450 |
| Infraestrutura (cabo, conectores) | Cat5e + RJ45 + ferramentas | — | R$ 200–400 |

> **Custo total estimado:** R$ 3.825 a R$ 5.265
> **Integração de vídeo:** go2rtc para stream WebRTC/MSE a partir de RTSP
> **Documento completo:** `CAMERAS_ESPECIFICACAO.md`

---

## 17. Integrações Necessárias

### 17.1 Emissor de NF-e / NFS-e

> **Recomendação:** [Nuvemfiscal](https://nuvemfiscal.com.br/) ou [Focus NFe](https://focusnfe.com.br/)
> Alternativa: [eNotas](https://enotas.com.br/)

### 17.2 WhatsApp Business API

> **Recomendação:** [Evolution API](https://evolution-api.com/) (open-source, self-hosted) ou [Z-API](https://www.z-api.io/) (SaaS brasileiro)
> Oficial: [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

### 17.3 Integração Bancária

| Banco | Uso | Integração |
|-------|-----|-----------|
| Santander | Principal | Open Banking / API Santander |
| Inter | Operações | API do Banco Inter |
| Caixa | Operações | CNAB 240/400 |
| Nubank | Operações | API limitada — OFX/CSV import |

### 17.4 Migração de Dados — Auvo API v2

> **URL da API:** `https://api.auvo.com.br/v2`
> **Documentação:** [https://auvoapiv2.docs.apiary.io/](https://auvoapiv2.docs.apiary.io/)

| # | Recurso Auvo | Entidade Kalibrium | Prioridade |
|---|-------------|-------------------|-----------|
| 1 | Customers | `Customer` | Alta |
| 2 | Equipments | `Equipment` | Alta |
| 3 | Tasks (OS) | `WorkOrder` | Alta |
| 4 | Quotations | Orçamentos | Média |
| 5 | Expenses | `Expense` | Média |
| 6 | Products / Services | `Product` / `Service` | Média |
| 7 | Users | Técnicos/Usuários | Média |
| 8 | Questionnaires | Checklists | Média |
| 9 | Equipment categories | Tipos | Baixa |
| 10 | Teams / Segments / Keywords | Grupos | Baixa |

---

## 18. Gaps Críticos Identificados (vs. Código Atual)

> Última verificação em 15/02/2026.

| # | Gap | Status | Impacto |
|---|-----|--------|---------|
| 1 | **PWA Offline para técnicos** | ❌ Nenhum service-worker | BLOQUEANTE para produção |
| 2 | **Pesos Padrão (cadastro + certificados)** | ❌ Nenhum model/entidade | Necessário para certificados |
| 3 | **Certificado Calibração ISO 17025 (PDF)** | ❌ Nenhum gerador | Core do negócio |
| 4 | **Toggles de despesa** | ✅ CORRIGIDO em 15/02 | `affects_net_value` e `affects_technician_cash` |
| 5 | **Numeração sequencial de certificado** | ⚠️ A verificar | Necessário se já tem sequência |
| 6 | **Integração WhatsApp** | ❌ Nenhuma referência | Importante mas não bloqueante |
| 7 | **Push Notifications** | ❌ Nenhum web-push | Importante para técnicos |
| 8 | **Integração NF-e/NFS-e** | ✅ Estrutura base existe | Falta ativação/testes |
| 9 | **Integração Bancária** | ⚠️ BankStatement existe | Falta import OFX/CNAB |
| 10 | **Histórico inteligente de preços** | ⚠️ PriceHistory existe | Falta UI inteligente |
| 11 | **Importação de dados do Auvo** | ✅ AuvoImportService existe | Falta teste real com dados |
| 12 | **Fluxo aprovação interna de orçamento** | ⚠️ A verificar | Necessário para workflow |
| 13 | **Autorização de deslocamento** | ✅ Implementado | dispatch_authorized_by/at |
| 14 | **Campo "Origem" no orçamento/OS** | ✅ Implementado | origin_type com source_filter |
| 15 | **Comissão vinculada a pagamento** | ✅ Implementado | Proporcional via AccountReceivable |
| 16 | **Divisor automático comissão** | ✅ Implementado (GAP-05) | split_divisor |
| 17 | **Técnico adiciona itens sem ver preço** | ⚠️ A verificar | Permissão granular |
| 18 | **Controle de abastecimento** | ✅ Fleet module existe | FleetFuelTab implementado |
| 19 | **Km rodados como despesa** | ✅ Implementado | km_quantity + km_rate no Expense |
| 20 | **Dashboard TV / Câmeras** | ✅ CORRIGIDO em 15/02 | Multi-tenancy, permissões, go2rtc |
| 21 | **Caixa técnico 2 saldos** | ✅ IMPLEMENTADO em 15/02 | balance + card_balance |
| 22 | **Categorias de despesa padrão** | ✅ IMPLEMENTADO em 15/02 | ExpenseCategorySeeder |
| 23 | **OS de garantia sem comissão** | ✅ IMPLEMENTADO em 15/02 | is_warranty + check no CommissionService |
| 24 | **Estorno automático comissão ao cancelar** | ✅ IMPLEMENTADO em 15/02 | HandleWorkOrderCancellation |

---

## 19. Prioridades de Implementação

### Sprint 0 — Fundação (Concluído em 15/02)

> Garantir que todos os módulos existentes estão 100% funcionais.

- [x] Auditoria de todos os módulos existentes (93% → 100%)
- [x] Implementação dos formulários do módulo Frota
- [x] Correção do módulo TV (multi-tenancy, permissões, câmeras)
- [x] Distinção dinheiro vs cartão no caixa do técnico
- [x] Categorias de despesa padrão
- [x] Estorno automático de comissão ao cancelar OS
- [x] Flag is_warranty na OS

### Sprint 1 — Core Business

1. Pesos Padrão (cadastro + certificados + validade)
2. Certificado de Calibração ISO 17025 (PDF completo)
3. Configuração de numeração sequencial por empresa

### Sprint 2 — Mobile Offline

1. PWA com Service Workers
2. Sync automático + manual
3. Visão restrita do técnico
4. Checklist + fotos + assinatura offline

### Sprint 3 — Integrações

1. Emissor NF-e/NFS-e (ativação completa)
2. WhatsApp Business API
3. Push notifications
4. Conciliação bancária (import OFX/CNAB)

### Sprint 4 — Inteligência e Migração

1. Histórico inteligente de preços
2. Import de dados do Auvo (via API v2)
3. Dashboards avançados
4. Relatórios customizados

---

## 20. Migrations Criadas (Rastreabilidade)

| Migration | Data | O que faz |
|-----------|------|----------|
| `2026_02_16_000010_add_display_name_to_roles_table` | 15/02 | Coluna `display_name` para nomes em português |
| `2026_02_16_000020_fix_role_names_technician_to_tecnico` | 15/02 | Renomeia roles para português |
| `2026_02_16_000030_add_tenant_id_to_cameras_table` | 15/02 | Multi-tenancy nas câmeras |
| `2026_02_16_000040_add_payment_method_to_technician_cash` | 15/02 | `card_balance` + `payment_method` |
| `2026_02_16_000050_add_is_warranty_to_work_orders` | 15/02 | Flag `is_warranty` na OS |
| `2026_02_16_000060_add_default_affects_net_value_to_expense_categories` | 15/02 | Defaults por categoria |

---

## 21. Seeders Relevantes

| Seeder | O que faz |
|--------|----------|
| `PermissionsSeeder` | Cria todas as permissões + roles (Técnico, Motorista, Vendedor, Financeiro, Monitor, etc.) |
| `ExpenseCategorySeeder` | Cria 10 categorias padrão de despesa com defaults |
| `SystemSettingsSeeder` | Configurações do sistema (dias de garantia, etc.) |

---

> **Este documento é vivo** — será atualizado conforme novas decisões forem tomadas.
> **REGRA:** Sempre ADITIVO. Para alterar algo existente, registrar "ANTES" e "DEPOIS" com data.
> **Última atualização:** 15/02/2026 (brainstorm rodadas 1-5 com Roldão)
