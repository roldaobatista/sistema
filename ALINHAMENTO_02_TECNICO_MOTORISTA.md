# Documento de Alinhamento — Parte 2: Técnico, Motorista e Visibilidade

> Continuação de `ALINHAMENTO_01_EMPRESA_FLUXO.md`

---

## 7. Técnico — Experiência Mobile Offline (REQUISITO CRÍTICO)

### Cenário Real

> O técnico está numa fazenda calibrando uma balança rodoviária, **sem internet**.
> Ele precisa trabalhar normalmente e sincronizar quando tiver sinal.

### Funcionalidades Offline Obrigatórias

| Função | Offline? | Detalhe |
|--------|----------|---------|
| Ver OS e dados dos equipamentos | ✅ | Dados sincronizados automaticamente |
| Preencher checklist por equipamento | ✅ | Cada balança tem seu próprio checklist |
| Tirar fotos do serviço | ✅ | Salvar localmente, enviar depois |
| Lançar despesas (com comprovante) | ✅ | Foto do comprovante + OS vinculada |
| Marcar OS como concluída | ✅ | Sincroniza status quando online |
| Colher assinatura do cliente | ✅ | Na tela do celular |
| Selecionar pesos padrão usados | ✅ | Lista pré-carregada |

### Sincronização

| Estratégia | Detalhe |
|-----------|---------|
| **Auto-sync** | Quando novos dados relevantes surgem para o técnico (ex: nova OS atribuída) |
| **Background sync** | Quando o celular detecta conexão, envia dados pendentes |
| **Conflict resolution** | Se o escritório editou algo enquanto o técnico estava offline |

### Restrições de Acesso do Técnico

| O técnico VÊ | O técnico NÃO VÊ |
|--------------|------------------|
| Suas OS atribuídas | OS de outros técnicos |
| Seus apontamentos de hora | Financeiro geral |
| Suas despesas | Despesas de outros |
| Valor da sua comissão (apenas valor final) | Preços de produtos/serviços |
| Seus equipamentos/checklists | Dados de faturamento |
| Adicionar itens na OS (sem ver preço) | Comissões de outros técnicos |

> **CUIDADO:** Técnico puro NUNCA vê valores de produtos ou serviços, mas PODE adicionar itens na OS.
> Exceção: Técnico-Vendedor (Rodolfo, Weberson) VÊ os valores.
> Cada técnico só vê suas próprias coisas — NUNCA as de outro técnico.

### Matriz de Visibilidade Completa

| Funcionalidade | Super Admin | Admin/Assistente | Financeiro | Téc.-Vendedor | Técnico Puro | Motorista | Monitor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Todas as OS | ✅ | ✅ | ❌ | ❌ só suas | ❌ só suas | ❌ só suas | ❌ |
| Preços serviços/produtos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Adicionar itens na OS | ✅ | ✅ | ❌ | ✅ | ✅ (sem preço) | ❌ | ❌ |
| Financeiro completo | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Comissões (geral) | ✅ | ✅ | ✅ | ❌ só dele | ❌ só dele | ❌ só dele | ❌ |
| Despesas (todas) | ✅ | ✅ (confere) | ✅ | ❌ só dele | ❌ só dele | ❌ só dele | ❌ |
| Aprovar orçamento | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar despesas | ✅ | ❌ (confere) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar comissão | ✅ | ❌ | ❌ (faz fechamento) | ❌ | ❌ | ❌ | ❌ |
| Emitir NF/boleto | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| App mobile (campo) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Lançar despesas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Controle abastecimento | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Dashboard TV / Câmeras | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Plataforma Mobile

- **Dispositivo principal:** Android
- **Abordagem:** PWA (Progressive Web App) com Service Workers

### Carga de Trabalho

- **1 a 3 OS por dia** por técnico
- Atendimento pode durar de 30 min a dia inteiro (balança rodoviária = operação longa)

---

## 8. Motorista / UMC (Unidade Móvel de Calibração)

| Item | Detalhe |
|------|---------|
| **Motorista atual** | Marcelo |
| **Veículo** | Caminhão UMC com pesos padrão (22×500kg = 11t) e guindauto |
| **Função** | Conduz o caminhão + opera guindauto para posicionar pesos na balança |
| **Acompanha** | O técnico, que vai em carro de assistência separado |
| **Quando vai** | Calibração rodoviária (obrigatório) ou como auxiliar quando não tem serviço |
| **No sistema** | Vinculado às mesmas OS do técnico |
| **App mobile** | ✅ Obrigatório — lança despesas e controle de abastecimento |

> **DECISÃO (15/02):** O uso de motorista/UMC é **às vezes** — depende do tipo de calibração. O sistema suporta motorista como opcional na OS.

### Controle de Abastecimento (Motorista)

| Campo | Obrigatório | Detalhe |
|-------|:-----------:|--------|
| Km rodados | ✅ | Odômetro do veículo |
| Placa do veículo | ✅ | Selecionável |
| Localização do posto | ✅ | Mapa com geolocalização |
| Posto | ✅ | Cadastrado ou cadastrar na hora (prático, pelo próprio motorista) |
| Litros | ✅ | Quantidade abastecida |
| Valor | ✅ | Valor total |

---

## 9. Ordem de Serviço — Detalhamento Técnico

### Status da OS (9 status com transições controladas)

```
open → awaiting_dispatch → in_progress → waiting_parts
                                       → waiting_approval
                                       → completed → delivered → invoiced
                                                               → cancelled
```

| Status | Significado |
|--------|------------|
| `open` | OS criada, aguardando início |
| `awaiting_dispatch` | Aguardando autorização de deslocamento |
| `in_progress` | Técnico em execução |
| `waiting_parts` | Aguardando peças/materiais |
| `waiting_approval` | Aguardando aprovação |
| `completed` | Técnico concluiu, falta faturar |
| `delivered` | Entregue ao cliente |
| `invoiced` | Faturada (NF emitida) |
| `cancelled` | Cancelada |

### Decisões sobre OS (15/02)

| Decisão | Resposta | Implementação |
|---------|----------|--------------|
| **OS de garantia** | Não paga comissão | Campo `is_warranty` (boolean) na OS. Se marcado, `CommissionService` retorna `[]` |
| **Deslocamento** | Sempre cobrado do cliente | Campo `displacement_value` obrigatório |
| **Desconto afeta comissão** | Sim — comissão sobre valor COM desconto | Comissão calculada sobre `total` que já inclui desconto |
| **OS cancelada** | Despesas ficam, comissão estorna | Listener `HandleWorkOrderCancellation` reverte comissões automaticamente |
| **Múltiplos técnicos** | Cada um recebe metade da sua regra | GAP-05: `split_divisor` automático por quantidade de técnicos |

### Funcionalidades da OS

| Funcionalidade | Status |
|---|---|
| CRUD completo | ✅ Implementado |
| 9 status com transições | ✅ Implementado |
| Múltiplos técnicos por OS | ✅ Implementado |
| Vendedor e motorista na OS | ✅ Implementado |
| Deslocamento cobrado | ✅ Implementado |
| Desconto (fixo + percentual, só admin) | ✅ Implementado |
| Itens (produtos + serviços) com cálculo | ✅ Implementado |
| Controle de estoque automático | ✅ Implementado |
| SLA policies | ✅ Implementado |
| Checklists por serviço | ✅ Implementado |
| Assinatura digital do cliente | ✅ Implementado |
| Chat interno (admin ↔ técnico) | ✅ Implementado |
| Auditoria completa | ✅ Implementado |
| Duplicação de OS | ✅ Implementado |
| Reabertura de OS | ✅ Implementado |
| Autorização de deslocamento | ✅ Implementado |
| PDF da OS | ✅ Implementado |
| Dashboard e estatísticas | ✅ Implementado |
| Permissões granulares | ✅ Implementado |
| Flag "OS de Garantia" | ✅ Implementado (15/02) |
| Origem (orçamento, chamado, contrato, manual) | ✅ Implementado |

### Cálculo do Total da OS

```
subtotal_itens = Σ (quantidade × preço_unitário - desconto_item)
total = subtotal_itens + displacement_value - discount - (total × discount_percentage / 100)
```

> O `total` é recalculado automaticamente via `recalculateTotal()` sempre que itens, deslocamento ou desconto mudam.

### Eventos da OS

| Evento | Quando dispara | O que faz |
|--------|---------------|----------|
| `WorkOrderStarted` | Status → `in_progress` | Notifica técnico |
| `WorkOrderCompleted` | Status → `completed` | Notifica admin |
| `WorkOrderInvoiced` | Status → `invoiced` | Gera comissões automaticamente |
| `WorkOrderCancelled` | Status → `cancelled` | Devolve estoque + estorna comissões |

---

## 10. Alertas e Notificações (Prioridade)

| # | Alerta | Prioridade | Canais |
|---|--------|-----------|--------|
| 1 | OS concluída sem faturamento | CRÍTICO | Sistema + WhatsApp + Push |
| 2 | Contrato recorrente com data se aproximando (1 semana) | CRÍTICO | Sistema + WhatsApp + Push |
| 3 | Equipamento com calibração vencendo | ALTO | Sistema + WhatsApp |
| 4 | Técnico com despesa pendente de prestação de conta | ALTO | Sistema + Push |
| 5 | SLA estourado | ALTO | Sistema + Push |
| 6 | Certificado de peso padrão vencendo | ALTO | Sistema |
| 7 | Orçamento próximo da validade | MÉDIO | Sistema |

---

> **Última atualização:** 15/02/2026
> **Próximo arquivo:** `ALINHAMENTO_03_FINANCEIRO.md`
