---
trigger: always_on
---

# PROJECT_RULES.md — Regras de Negócio do Kalibrium

> Regras **exclusivas do negócio** de calibração de balanças.
> Regras gerais de código, CRUD, UX e permissões já estão no `GEMINI.md` — **não repetir aqui**.

---

## 1. FLUXOS DE NEGÓCIO

### 1.1 Orçamento → OS → Faturamento

```text
Criar Orçamento → Aprovação Interna (admin) → Enviar ao Cliente → Cliente Aprova → OS ou Chamado → Execução → Certificado → Faturamento Manual

REGRAS INEGOCIÁVEIS:
• Nenhum orçamento pode ser enviado sem aprovação interna do admin
• Todo desconto DEVE passar pelo admin
• Faturamento é SEMPRE manual — nunca automático
• OS concluída sem faturamento = alerta CRÍTICO persistente
• Campo "Origem" obrigatório (prospecção, retorno, contato_direto, indicação) — afeta comissão

EXCEÇÕES:
• OS Direta: cliente liga e pede atendimento imediato, sem orçamento prévio
• Orçamento pode ser convertido em Chamado (agendamento) em vez de OS
```

### 1.2 Comissões

```text
REGRAS:
• Comissão SOMENTE após recebimento do cliente (parcela paga)
• Se parcelado, só entra a parcela paga no mês do fechamento
• Base de cálculo configurável por regra (% bruto, % líquido, valor fixo)
• Campo "Origem" afeta % do vendedor (prospecção = maior, retorno = menor)
• 2+ técnicos na OS = 50% da comissão para cada
• Técnico-vendedor na mesma OS = comissão só de técnico (não acumula)
• Motorista ganha valor fixo por OS (somente calibração rodoviária com UMC)
• Toggles de despesa: "influencia no líquido" e "afeta caixa do técnico"
• Fechamento mensal: financeiro fecha → admin aprova
• Relatório detalhado OS por OS com cálculo explícito (para contestações)

EXCEÇÕES:
• Comissão pode ser ajustada manualmente pelo admin em situações especiais
• Regras de % são configuráveis — nunca hardcoded no código
```

### 1.3 Certificado de Calibração (ISO 17025)

```text
• 1 OS = N certificados (um por equipamento/balança)
• Checklist preenchido é PRÉ-REQUISITO para gerar certificado
• Numeração sequencial por empresa (CNPJ)
• Pesos padrão são entidade SEPARADA (não são "equipamentos")
• Rastreabilidade completa dos padrões (nº certificado + validade)
• Resultados: valor referência, indicação crescente/decrescente, erro, incerteza expandida, fator k
• Ensaio de excentricidade como anexo
• PDF profissional seguindo layout ISO 17025
```

### 1.4 Despesas

```text
• Toda despesa DEVE ter OS vinculada
• Comprovante (foto) obrigatório
• Toggle "Influencia no líquido da OS" — configurável por despesa
• Toggle "Afeta caixa do técnico" — despesas da empresa NÃO afetam
• Km rodados como tipo de despesa (valor/km configurável por técnico)
• Fluxo: técnico lança → assistente confere → admin aprova

EXCEÇÕES:
• Despesas administrativas (ex: material de escritório) podem não ter OS vinculada
```

### 1.5 Caixa do Técnico (Transferências)

```text
FLUXO: Empresa recarrega (cartão/transferência) → Saldo do técnico aumenta → Técnico gasta em campo → Presta contas

REGRAS:
• Toda transferência empresa→técnico DEVE gerar: 1 conta a pagar (AP) + 1 crédito no caixa do técnico
• Transferência é atômica: AP + crédito criados juntos ou nenhum
• Cancelar transferência DEVE reverter crédito + cancelar AP
• Contas bancárias são por empresa (tenant) — cada CNPJ tem suas contas
• Saldo do técnico = créditos (transferências) - débitos (despesas aprovadas)
• Fontes de pagamento: cartão corporativo, transferência bancária, dinheiro próprio (reembolso)
• Km rodados: valor/km configurável por técnico (R$ 1,00 ou R$ 1,80)

EXCEÇÕES:
• Transferência não precisa de aprovação (é ato administrativo direto)
• Motorista também recebe transferências (controle de abastecimento)
```

---

## 2. VISIBILIDADE POR PERFIL

| Dado | Super Admin | Admin | Financeiro | Téc.-Vendedor | Técnico | Motorista |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| Todas as OS | ✅ | ✅ | ❌ | só suas | só suas | só suas |
| Preços serviços/produtos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Financeiro completo | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Comissões de outros | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Aprovar orçamento | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar despesas | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| App mobile (campo) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

> **Regra de ouro:** Técnico puro NUNCA vê preços. Técnico-Vendedor VÊ.
> Cada técnico só vê seus próprios dados — NUNCA de outro.

---

## 3. MULTI-TENANT (3 CNPJs)

```text
• Todo registro DEVE ter tenant_id
• Mesma equipe nas 3 empresas
• Caixa financeiro: visão consolidada com filtro por empresa
• Contas bancárias: separadas por empresa
• Certificados: numeração sequencial POR EMPRESA (CNPJ)

EXCEÇÕES:
• Cadastro de usuários/técnicos é compartilhado entre tenants
• Dados mestre (categorias, formas de pagamento) podem ser globais
```

---

## 4. ALERTAS OBRIGATÓRIOS DO NEGÓCIO

| Alerta | Prioridade |
|--------|-----------|
| OS concluída sem faturamento | 🔴 CRÍTICO |
| Contrato recorrente vencendo (1 semana) | 🔴 CRÍTICO |
| Calibração de equipamento vencendo | 🟡 ALTO |
| Certificado de peso padrão vencendo | 🟡 ALTO |
| SLA estourado | 🟠 ALTO |
| Orçamento próximo da validade | 🟡 MÉDIO |
| Cliente inativo há X meses | 🟡 MÉDIO |
| Estoque abaixo do mínimo | 🟡 MÉDIO |

---

## 5. TÉCNICO MOBILE (OFFLINE-FIRST)

```text
• Funciona 100% offline: ver OS, checklist, fotos, despesas, assinatura
• Sync automático quando detecta conexão
• Resolução de conflitos quando escritório editou algo durante offline
• Dispositivo principal: Android (PWA)
• Carga: 1 a 3 OS por dia por técnico
```

---

## 6. SUGESTÕES PROATIVAS

> Ao trabalhar em qualquer módulo, considerar se faz sentido sugerir:

```text
OPERACIONAL: produtividade/técnico, mapa de calor, rota otimizada, custo real vs orçado
FINANCEIRO: projeção de caixa, score inadimplência, análise ABC de clientes
COMERCIAL: conversão orçamento→OS, clientes inativos, contratos vencendo
TÉCNICO: não-conformidade/técnico, rastreabilidade reversa de pesos, validade certificados
```

> **EXCEÇÃO:** Não sugerir funcionalidades quando o pedido do usuário é pontual (fix de bug, typo, ajuste cosmético). Sugerir apenas quando estiver trabalhando no módulo de forma substancial.
