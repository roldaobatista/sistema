# Documento de Alinhamento — Parte 3: Financeiro (Despesas, Comissões, Caixa)

> Continuação de `ALINHAMENTO_02_TECNICO_MOTORISTA.md`
> Todas as decisões desta seção foram tomadas em 15/02/2026 através de questionário detalhado com Roldão.

---

## 11. Caixa do Técnico — Fluxo Completo

### Decisões (15/02)

| Decisão | Resposta do Roldão | Implementação |
|---------|-------------------|--------------|
| **Fontes de pagamento** | Dinheiro transferido para conta + cartão corporativo de uso único | Sistema rastreia 2 saldos separados: `balance` (dinheiro) e `card_balance` (cartão) |
| **Fluxo de aprovação** | Técnico gasta → Admin confere → Roldão aprova | Workflow: `pending` → `reviewed` → `approved` |
| **Quando recarrega** | Quando técnico precisa de mais, admin analisa o caixa e encaminha para Roldão | Créditos manuais via admin com `payment_method` |

### Diagrama do Fluxo

```
Empresa recarrega cartão corporativo ──→ card_balance ↑
Empresa transfere dinheiro na conta  ──→ balance ↑
                                              │
                                              ▼
                                    Técnico tem despesa em campo
                                              │
                                              ▼
                                    Lança despesa no app
                                    (comprovante obrigatório)
                                              │
                                              ▼
                                    Alessandra confere os dados
                                              │
                                              ▼
                                    Roldão aprova
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        Influencia       NÃO influencia   Não afeta
                        no líquido       no líquido        caixa do
                        (affects_net)    (despesas de      técnico
                              │           conveniência)    (empresa
                              ▼               │            paga direto)
                        Desconta do           ▼
                        valor líquido   Não afeta cálculo
                        para comissão   de comissão
```

### Estrutura dos Saldos no Sistema

| Campo | Tabela | Significado |
|-------|--------|------------|
| `balance` | `technician_cash_funds` | Saldo em dinheiro (transferências bancárias) |
| `card_balance` | `technician_cash_funds` | Saldo no cartão corporativo |
| `payment_method` | `technician_cash_transactions` | `cash` ou `corporate_card` — identifica de qual saldo saiu |

> **DECISÃO (15/02):** O sistema agora distingue crédito/débito por **meio de pagamento**. Ao adicionar crédito ou débito, o admin seleciona se é do dinheiro ou do cartão corporativo. Cada saldo é rastreado separadamente.

### Fontes de Pagamento

| Fonte | Funcionamento | `payment_method` |
|-------|--------------|-----------------|
| **Dinheiro na conta** | Empresa transfere, técnico presta conta | `cash` |
| **Cartão corporativo** | Saldo pré-carregado, técnico presta conta | `corporate_card` |
| **Dinheiro próprio** | Técnico paga e empresa reembolsa | `cash` (reembolso) |

### Km Rodados (Técnicos com carro próprio)

| Técnico | Valor/km | Condição |
|---------|----------|----------|
| **Rodolfo** | R$ 1,00/km | Todo deslocamento |
| **Weberson** | R$ 1,00/km | Deslocamento NÃO cobrado do cliente |
| **Weberson** | R$ 1,80/km | Deslocamento cobrado do cliente |

> O km rodado é lançado como despesa na OS, informando quantidade de km e valor.

---

## 12. Despesas — Decisões Detalhadas

### Quem gera despesas (15/02)

> **Resposta:** Ambos — técnico gasta em campo E escritório compra.

### Todos os tipos de despesa são comuns (15/02)

> **Resposta:** Todas as opções (combustível, alimentação, peças, pedágio, hospedagem, ferramentas).

### Categorias Padrão Criadas no Seeder

| Categoria | Cor | Afeta Comissão? (`default_affects_net_value`) | Afeta Caixa Técnico? (`default_affects_technician_cash`) |
|---|---|:---:|:---:|
| **Combustível** | Vermelho | ✅ SIM | ✅ SIM |
| **Alimentação / Refeição** | Laranja | ❌ NÃO | ✅ SIM |
| **Peças / Materiais (compra)** | Azul | ✅ SIM | ✅ SIM |
| **Pedágio** | Roxo | ✅ SIM | ✅ SIM |
| **Hospedagem** | Ciano | ❌ NÃO | ✅ SIM |
| **Ferramentas** | Verde | ❌ NÃO | ✅ SIM |
| **Material de Escritório** | Cinza | ❌ NÃO | ❌ NÃO |
| **Manutenção de Veículo** | Amarelo | ❌ NÃO | ❌ NÃO |
| **Estacionamento** | Lilás | ✅ SIM | ✅ SIM |
| **Outros** | Cinza escuro | ❌ NÃO | ❌ NÃO |

> **DECISÃO (15/02):** `default_affects_net_value` e `default_affects_technician_cash` são campos na tabela `expense_categories` que servem como **valor padrão** ao criar uma despesa daquela categoria. O admin pode alterar caso a caso em cada despesa individual.

### Regras de Despesa

| Regra | Detalhe |
|-------|---------|
| **Toda despesa MUST ter OS vinculada** | Obrigatório |
| **Comprovante obrigatório** | Foto do recibo/nota |
| **Toggle "Influencia no líquido"** | Admin pode marcar/desmarcar. Mesmo tipo pode variar por situação |
| **Toggle "Afeta caixa do técnico"** | Despesas administrativas ou pagas pela empresa NÃO afetam o caixa |
| **Múltiplos técnicos por OS** | Cada um lança suas despesas separadamente na mesma OS |

### Fluxo de Aprovação de Despesas (15/02)

> **Resposta do Roldão:** "O técnico vai usando conforme alinhamento em reunião. Quando ele precisa de mais dinheiro, o administrativo analisa o caixa do técnico, vê as despesas e se estiver tudo certo encaminha para eu aprovar."

```
Técnico/motorista lança despesa no app (com comprovante)
    ↓
Despesa fica com status "pending"
    ↓
Alessandra confere os dados → status "reviewed"
    ↓
Roldão aprova → status "approved"
    ↓
Se affects_technician_cash: debita do caixa do técnico
Se affects_net_value: será descontado no cálculo de comissão
```

### Status de Despesa

| Status | Significado | Quem muda |
|--------|------------|-----------|
| `pending` | Lançada pelo técnico, aguardando conferência | Técnico |
| `reviewed` | Conferida pelo admin, aguardando aprovação final | Admin/Assistente |
| `approved` | Aprovada — se `affects_technician_cash`, debita caixa | Super Admin |
| `rejected` | Rejeitada — motivo obrigatório | Super Admin/Admin |
| `reimbursed` | Reembolsada — técnico pagou do bolso e foi ressarcido | Admin |

### Integração Despesa ↔ Caixa do Técnico

| Ação | Efeito no Caixa |
|------|----------------|
| Despesa aprovada com `affects_technician_cash` = true | **Débito** no caixa do técnico |
| Despesa reembolsada com `affects_technician_cash` = true | **Crédito** no caixa do técnico |
| Despesa aprovada com `affects_technician_cash` = false | Nenhum efeito no caixa |

### Integração Despesa ↔ Comissão

| Flag | Efeito na Comissão |
|------|-------------------|
| `affects_net_value` = true | Despesa é subtraída do valor bruto para calcular o valor líquido usado em `percent_net` |
| `affects_net_value` = false | Despesa NÃO afeta cálculo de comissão |

---

## 13. Comissões — Regras Complexas (Decisões 15/02)

### Decisões Chave

| Pergunta | Resposta do Roldão | Implementação |
|----------|-------------------|--------------|
| **Remuneração dos técnicos** | Tem de todas as opções — cada técnico tem uma regra e um tipo | Sistema suporta regra individual por técnico |
| **Base de cálculo** | Todos os tipos | 10+ calculation_types implementados |
| **Percentual de comissão** | Variável por técnico | Cada CommissionRule tem seu `value` |
| **Comissão de vendedor** | Todas as opções configuradas | Rules com `applies_to_role = seller` |
| **Quando libera comissão** | Fechamento mensal das parcelas já pagas | CommissionSettlement mensal com liberação proporcional |
| **Divisão entre técnicos** | Cada um recebe metade da sua regra específica | `split_divisor` automático |
| **Desconto afeta comissão** | Sim — sobre valor COM desconto | Comissão usa `wo->total` que já inclui desconto |
| **Garantia sem comissão** | Não paga | `is_warranty` flag + check no CommissionService |
| **OS cancelada** | Despesas ficam, comissão estorna | HandleWorkOrderCancellation reverte CommissionEvents |
| **Quais despesas reduzem comissão** | Configurável caso a caso por categoria | `affects_net_value` individual por despesa |
| **Regra flexível por técnico** | No futuro: % do bruto, ou líquido menos peças, ou menos deslocamento etc | CommissionRule.calculation_type controla tudo |

### Regra Geral

| Regra | Detalhe |
|-------|---------|
| **Quando paga** | Somente APÓS recebimento do cliente |
| **Se parcelado** | Só entra a parcela paga no mês do fechamento |
| **Fechamento** | Mensal — início do mês seguinte (dia 1-5). Nayara faz, Roldão aprova |
| **Contestações** | Frequentes — relatórios devem ser detalhados OS por OS com cálculo explícito |
| **Metas** | Existem metas configuráveis para vendedores e técnicos |

### Todos os Tipos de Cálculo de Comissão Disponíveis

| Tipo | Fórmula | Exemplo |
|------|---------|---------|
| `percent_gross` | % do valor bruto da OS | 10% de R$ 5.000 = R$ 500 |
| `percent_net` | % do líquido (bruto - despesas com `affects_net_value`) | 10% de (R$ 5.000 - R$ 800) = R$ 420 |
| `percent_services_only` | % do bruto apenas dos serviços (sem produtos) | 10% sobre R$ 3.000 (serviços) = R$ 300 |
| `percent_gross_minus_displacement` | % do bruto menos deslocamento | 10% de (R$ 5.000 - R$ 200 desloc.) = R$ 480 |
| `percent_gross_minus_expenses` | % do bruto menos todas as despesas da OS | 10% de (R$ 5.000 - R$ 500 desp.) = R$ 450 |
| `percent_profit` | % do lucro (total - custo - despesas) | 10% de (R$ 5.000 - R$ 2.000 custo) = R$ 300 |
| `fixed_per_os` | Valor fixo por OS executada | R$ 150 por OS |
| `tiered_gross` | % escalonado por faixa de valor | 5% até R$ 3.000 + 8% acima |
| `percent_products_only` | % sobre valor de produtos apenas | Para vendedores |
| `fixed_per_item` | Valor fixo por item | Para itens específicos |

> **DECISÃO (15/02):** "Quero ter configurações na regra de comissão. No futuro posso ter um técnico que ganha X% do valor da OS, mas sobre o bruto OU líquido menos peças, OU menos deslocamento cobrado do cliente, etc." — **Já implementado** via `calculation_type`.

### Regras por Perfil

| Perfil | Base de Cálculo | Detalhe |
|--------|----------------|--------|
| **Vendedor (fechamento)** | % do bruto dos serviços | % menor — cliente veio por conta própria |
| **Vendedor (prospecção)** | % do bruto dos serviços | % **maior** — vendedor trouxe o cliente |
| **Técnico** | % ou valor fixo por OS | Cada técnico pode ter regras diferentes e múltiplas |
| **Técnico (venda de produto)** | Comissão sobre venda | Ganha comissão em vendas mesmo não sendo vendedor |
| **Técnico-vendedor (mesma OS)** | Só comissão de **técnico** | NÃO acumula vendedor + técnico na mesma OS |
| **Motorista** | Valor fixo por OS | Só quando UMC é usada (calibração rodoviária) |

### Divisão entre Múltiplos Técnicos (15/02)

> **Resposta:** "Recebe a metade da sua regra específica."

| Cenário | Regra |
|---------|-------|
| 1 técnico na OS | Ganha 100% da sua comissão |
| 2+ técnicos na OS | Cada um ganha **50%** do que ganharia sozinho (sua própria regra ÷ 2) |

### Fluxo de Liberação de Comissão (15/02)

> **Resposta:** "Fechamento mensal das parcelas já pagas." e "Misto — comissão gerada ao faturar, mas só liberada conforme pagamento."

```
OS faturada (invoiced)
    ↓
CommissionService::calculateAndGenerate()
    ↓
CommissionEvent criado com status "pending"
    ↓
Cliente paga parcela 1/3
    ↓
CommissionEvent proporcionalmente liberado (33%)
    ↓
Cliente paga parcela 2/3 e 3/3
    ↓
CommissionEvent 100% liberado
    ↓
Fim do mês → Fechamento mensal (CommissionSettlement)
    ↓
Nayara consolida → Roldão aprova → Paga ao técnico
```

### Especificidades

| Regra | Detalhe |
|-------|---------|
| **Comissão por técnico** | Cada técnico pode ter regra/percentual diferente |
| **Múltiplos técnicos na OS** | Divisão automática (50% cada) |
| **Despesas afetam o líquido** | Apenas as marcadas como `affects_net_value` |
| **Técnico vê** | Apenas o **valor final** da sua comissão, nunca os preços dos itens |
| **Regras configuráveis** | Todas via admin, nunca hardcoded |
| **Campanhas temporárias** | Multiplicador de comissão por período |
| **Metas** | CommissionGoal por técnico/vendedor |
| **Contestações** | CommissionDispute com workflow de análise |
| **Comissão recorrente** | Para contratos com periodicidade |

### Cancelamento de OS — Efeito em Comissões e Despesas (15/02)

> **Resposta:** "Despesas ficam (técnico já gastou), comissão estorna."

| Item | O que acontece |
|------|---------------|
| **Despesas** | **Permanecem** — técnico já gastou o dinheiro, não pode ser desfeito |
| **Comissões pendentes/aprovadas** | **Estornadas automaticamente** — status vira `reversed` |
| **Comissões já pagas** | Ficam como estão — estorno manual se necessário |
| **Estoque reservado** | Devolvido automaticamente |

---

## 14. Relatórios Prioritários (15/02)

> **Resposta:** "Todos" — precisa de todos os 4 relatórios.

| # | Relatório | Endpoint | Status |
|---|-----------|----------|--------|
| 1 | **Extrato de comissão por técnico** | `GET /api/v1/commission-statement/pdf` | ✅ Implementado (PDF) |
| 2 | **Despesas por OS** | `GET /api/v1/expense-analytics/by-work-order` | ✅ Implementado |
| 3 | **Lucratividade por OS** | `GET /api/v1/reports/profitability` | ✅ Implementado |
| 4 | **Caixa do técnico** | `GET /api/v1/reports/technician-cash` | ✅ Implementado |
| 5 | **Resumo de comissões** | `GET /api/v1/commission-summary` | ✅ Implementado |
| 6 | **Export de eventos CSV** | `GET /api/v1/commission-events/export` | ✅ Implementado |
| 7 | **Export de fechamentos CSV** | `GET /api/v1/commission-settlements/export` | ✅ Implementado |

---

> **Última atualização:** 15/02/2026
> **Próximo arquivo:** `ALINHAMENTO_04_DECISOES_IMPLEMENTACAO.md`
