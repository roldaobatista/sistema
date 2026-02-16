# Documento de Alinhamento — Parte 1: Empresa, Equipe e Fluxo

> Documento consolidado a partir de múltiplas rodadas de brainstorm (12–15/02/2026).
> Esta é a "bíblia" do sistema — referência para todas as decisões de implementação.
> **DIVIDIDO EM 4 PARTES** para facilitar consulta e manutenção.

> [!CAUTION]
> **REGRA MÁXIMA: TUDO deve ser controlado por perfis e autorizações granulares. NADA hardcoded.**
> Toda funcionalidade, visibilidade e ação deve ser configurável via permissões.
> Nenhuma regra de negócio pode ser fixa no código — deve ser editável pelo admin.

---

## Índice dos 4 Arquivos

| Arquivo | Conteúdo |
|---------|----------|
| **ALINHAMENTO_01** (este) | Empresa, Equipe, Fluxo Principal, Orçamento, Contratos |
| **ALINHAMENTO_02** | Técnico Mobile, Motorista/UMC, Matriz de Visibilidade |
| **ALINHAMENTO_03** | Caixa do Técnico, Despesas, Comissões, Relatórios |
| **ALINHAMENTO_04** | Decisões Técnicas, TV/Câmeras, Integrações, Gaps, Sprints |

---

## 1. A Empresa

| Item | Detalhe |
|------|---------|
| **Segmento** | Calibração de balanças (rodoviárias e industriais) |
| **Região** | Brasil inteiro — 97% Mato Grosso, 2% Mato Grosso do Sul, 1% outros |
| **Sede** | Rondonópolis, MT |
| **Empresas** | 3 CNPJs distintos, mesma equipe operacional e administrativa |
| **Diferencial** | As 3 empresas fazem os mesmos serviços, não há separação de especialidade |
| **Sistema atual** | **Auvo** (orçamentos, OS, NF) — será substituído pelo Kalibrium |

### Empresas (CNPJs) — Cadastro Manual

| Razão Social | Nome Fantasia | Observação |
|---|---|---|
| Balanças Solution Ltda | Balanças Solution | — |
| Solution Automação e Pesagem Ltda | Balanças Solution | Mesmo nome fantasia |
| Kalibrium Balanças | Kalibrium Balanças | — |

> **IMPORTANTE:** Cada empresa deve ser cadastrada manualmente com suas configurações individuais. Não pré-popular via seeder.

### Multi-Tenant

| Aspecto | Comportamento |
|---------|--------------|
| **3 tenants** | 3 empresas com CNPJs distintos (cadastro manual) |
| **Mesma equipe** | Técnicos e admin são os mesmos nas 3 |
| **OS por empresa** | A OS já é criada dentro da empresa correta |
| **Trocar empresa** | Usuário alterna entre tenants no sistema |
| **Sem filiais** | Não usam o conceito de filiais |
| **Técnicos por região** | Técnicos são organizados por região do estado |
| **Caixa financeiro** | Consolidado — visão única das 3 empresas com filtro por CNPJ |
| **Contas bancárias** | Separadas por empresa |

---

## 2. Equipe e Perfis

### Perfis do Sistema (nomes em português)

> **DECISÃO (15/02):** Nomes dos perfis no sistema devem ser em **português**.
> **DECISÃO (15/02):** Um mesmo usuário pode ter **múltiplos perfis** e o acesso é a **união** (soma) de todas as permissões.
> **DECISÃO (15/02):** Mesmo com múltiplos perfis, é possível **remover permissões individuais** de um usuário específico.

| Papel | Usa diariamente | Dispositivo principal | Acesso |
|-------|-----------------|----------------------|--------|
| **Super Admin** | ✅ | Desktop | Tudo |
| **Gerente** | ✅ | Desktop | Operações + Financeiro + Relatórios |
| **Coordenador** | ✅ | Desktop | Operacional + RH |
| **Atendente** | ✅ | Desktop | Clientes, OS, recebíveis |
| **Vendedor** | ✅ | Desktop + Mobile | Clientes, orçamentos, comissões |
| **Técnico** | ✅ | **Mobile (offline-first)** | Apenas suas OS, despesas, comissão (só valor) |
| **Motorista** | ✅ | Mobile | Suas OS, despesas, abastecimento |
| **Técnico-Vendedor** | ✅ | Mobile + Desktop | Acumula ambos os perfis com acesso a valores |
| **Financeiro** | ✅ | Desktop | Todo financeiro, comissões |
| **Monitor** | ✅ | TV/Desktop | Dashboard TV e câmeras de monitoramento |

### Equipe Real (referência para configuração)

| Nome | Função | Role | Região / Detalhe |
|------|--------|------|------------------|
| **Roldão** | Proprietário, aprova tudo | `super_admin` | Recebe 70% dos contatos de clientes |
| **Alessandra** | Assistente admin + financeiro (faz tudo) | `admin` ou role amplo | Faz orçamentos, confere despesas, negocia pagamento |
| **Nayara** | Financeira responsável | `financeiro` | NF, boletos, fechamento de comissão |
| **Rodolfo** | Técnico-vendedor (carro próprio) | `tecnico_vendedor` | Campo Novo do Parecis (200km) + Juína. R$ 1,00/km |
| **Weberson** | Técnico-vendedor (carro próprio) | `tecnico_vendedor` | Nova Mutum (200km) + Sinop. R$ 1,00/km ou R$ 1,80/km |
| **Hugo** | Técnico | `tecnico` | Campo Grande / Rondonópolis |
| **Técnicos 4–6** | Técnicos | `tecnico` | A cadastrar manualmente no sistema |
| **Marcelo** | Motorista UMC | `motorista` | Caminhão com pesos padrão (22×500kg = 11t) |

> **Captação de clientes:** 70% Roldão (WhatsApp/ligação) → 5% Alessandra (e-mail) → 25% Rodolfo/Weberson (clientes próprios)

### Sistema de Permissões — Decisões

| Decisão | Data | Detalhe |
|---------|------|---------|
| Nomes em português | 15/02 | Todos os perfis exibem nome em português no frontend |
| Múltiplos perfis por usuário | 15/02 | Ex: técnico + vendedor. Permissões se somam |
| Remoção individual de permissão | 15/02 | Mesmo que o perfil dê acesso, é possível tirar de um usuário específico |
| Coluna `display_name` em roles | 15/02 | Cada role tem `name` (slug) + `display_name` (nome em pt-BR) |
| Role "Monitor" criada | 15/02 | Acesso ao dashboard TV e câmeras |

---

## 3. Fluxo Principal de Negócio

> **DECISÃO (15/02):** O fluxo é **misto** — depende do tipo de cliente e situação. Pode ser OS direta, via orçamento, via chamado ou contrato recorrente.

```
ENTRADA                    EXECUÇÃO                   FINANCEIRO
────────                   ────────                   ──────────
Cliente liga        ┐
Vendedor capta      │      ┌──────────────┐          ┌──────────────┐
Chamado aberto      ├─────→│   OS ABERTA  │─────────→│  FATURAMENTO │
Contrato recorrente │      │              │          │  (NF emitida)│
Orçamento aprovado  ┘      │  Técnico(s)  │          └──────┬───────┘
                           │  Motorista?  │                 │
                           │  Vendedor?   │                 ▼
                           │              │          ┌──────────────┐
                           │  + Itens     │          │  CONTAS A    │
                           │  + Despesas  │          │  RECEBER     │
                           │  + Desloc.   │          │  (parcelas)  │
                           └──────────────┘          └──────┬───────┘
                                  │                         │
                                  │                         │ cliente paga
                                  ▼                         │ parcela
                           ┌──────────────┐                 │
                           │  DESPESAS    │          ┌──────▼───────┐
                           │  (vinculadas │          │  COMISSÃO    │
                           │   à OS)      │          │  LIBERADA    │
                           │              │──────→   │  proporcional│
                           │  Combustível │ reduz    │  ao pagamento│
                           │  Alimentação │ valor    └──────┬───────┘
                           │  Peças local │ líquido         │
                           │  Pedágio     │                 │
                           │  Hospedagem  │          ┌──────▼───────┐
                           │  Ferramentas │          │  FECHAMENTO  │
                           └──────────────┘          │  MENSAL      │
                                  │                  │  (dia 1-5)   │
                                  ▼                  └──────────────┘
                           ┌──────────────┐
                           │  CAIXA DO    │
                           │  TÉCNICO     │
                           │              │
                           │  Dinheiro    │
                           │  Cartão Corp.│
                           └──────────────┘
```

### Regras do Fluxo

| Regra | Detalhe |
|-------|---------|
| **Orçamento → OS** | Quando o cliente aprova e será atendido imediatamente |
| **Orçamento → Chamado** | Quando o cliente aprova mas o atendimento será agendado |
| **OS Direta** | Cliente liga e pede atendimento imediato, sem orçamento |
| **Contrato recorrente** | OS gerada automaticamente conforme periodicidade |
| **Faturamento** | Sempre MANUAL após negociação — **nunca automático** |
| **Alerta crítico** | OS concluída sem faturamento → notificação persistente |
| **Orçamento tem validade** | Configurável (ex: 30 dias). Alertar quando próximo do vencimento |
| **Autorização de deslocamento** | Técnico só inicia deslocamento após autorização do admin no sistema |

### Decisões sobre Tipo de Serviço (15/02)

| Pergunta | Resposta do Roldão | Impacto no sistema |
|----------|-------------------|-------------------|
| Tipo principal de serviço? | **Serviço em campo** (técnico vai até o cliente) | Mobile offline-first é requisito crítico |
| Equipe típica por OS? | **Varia conforme o serviço** (solo, dupla, equipe) | Sistema suporta N técnicos + motorista por OS |
| Tem vendedor separado? | **Misto** — às vezes tem, às vezes não | Campo `seller_id` opcional na OS |
| Cobra deslocamento? | **Sempre** — valor fixo ou por km | Campo `displacement_value` obrigatório na OS |
| Materiais usados? | **Às vezes nosso, às vezes do cliente** | Itens de produto opcionais na OS |

### Fluxo de Aprovação Interna do Orçamento

```
Alessandra cria orçamento → Status: "Aguardando Aprovação Interna"
    ↓
Roldão revisa (preços, região, cliente) → Aprova ou solicita correção
    ↓
Status: "Aprovado Internamente"
    ↓
Técnico/vendedor envia ao cliente → Status: "Enviado"
    ↓
Cliente aprova → Status: "Aprovado"
```

> **IMPORTANTE:** Nenhum orçamento pode ser enviado ao cliente sem aprovação interna do admin.

### Fluxo Pós-Execução (Faturamento)

```
OS concluída → Alessandra negocia pagamento com cliente
    ↓
Define condição (à vista, 20/40 boleto, negociável)
    ↓
Nayara emite NF + boleto
    ↓
Acompanha recebimento → Comissões liberadas proporcionalmente
```

---

## 4. Orçamento — Detalhamento

### Estrutura do Orçamento

```
Orçamento
├── Cliente (obrigatório)
├── Empresa/Tenant (obrigatório — qual CNPJ)
├── Validade (data)
├── Equipamento 1 (vinculado ao cliente)
│   ├── Serviço A (com preço)
│   ├── Serviço B (com preço)
│   ├── Produto X (com preço + foto miniatura se cadastrada)
│   └── Produto Y (com preço + foto miniatura se cadastrada)
├── Equipamento 2 (vinculado ao cliente)
│   ├── Serviço C
│   └── Produto Z
├── Fotos anexadas (galeria celular ou computador)
├── Deslocamento (por km rodado — pode cobrar ou não)
├── Campo "Origem" (prospecção, retorno, contato_direto, indicação)
└── Observações / Condições comerciais
```

> **Deslocamento:** Cobrado por km rodado. Valor configurável.
> **Campo Origem:** Necessário para diferenciar comissão de vendedor (prospecção = % maior, retorno = % menor).
> **Desconto:** Todo desconto passa pelo admin — sem autonomia para dar desconto.

### Regras de Precificação

| Critério | Detalhe |
|----------|---------|
| **Por região** | Preço diferente por localidade |
| **Por cliente** | Preço especial para clientes recorrentes |
| **Por tipo de cliente** | Governo, indústria, comércio, etc. |
| **Histórico inteligente** | Ao lançar item para um cliente, mostrar últimos preços praticados para ele |

### Aprovação pelo Cliente

| Canal | Como funciona |
|-------|--------------|
| **Link público** | E-mail/WhatsApp com link e botão "Aprovar" |
| **WhatsApp** | Cliente confirma por mensagem |
| **Ligação** | Atendente marca como aprovado no sistema |
| **E-mail** | Cliente responde confirmando |

---

## 5. Contratos Recorrentes

| Tipo | Comportamento |
|------|--------------|
| **On-demand** | Cliente chama quando precisa, sem periodicidade |
| **Programado** | Datas fixas (ex: mensal, trimestral, semestral) |

### Alertas de Contrato

- **1 semana antes** da data programada → Notificação para abrir chamado técnico
- Canais: sistema + WhatsApp + push mobile

---

## 6. Certificado de Calibração — ISO 17025

### Fluxo de Geração

```
Técnico preenche checklist em campo
    ↓
Dados sincronizam com o escritório
    ↓
Escritório revisa os dados
    ↓
Responsável técnico gera o certificado (PDF)
    ↓
Certificado com numeração sequencial por empresa
```

> **Quem emite hoje:** Roldão. **Futuro:** Supervisor da assistência técnica.
> **Assinatura:** Imagem da assinatura (não ICP-Brasil digital).
> **1 OS = N certificados:** Cada equipamento/balança gera certificado separado.

### Estrutura Real do Certificado

**Página 1 — Dados e Rastreabilidade:**

| Seção | Campos |
|-------|--------|
| **1. Dados do Cliente** | Solicitante, CNPJ, endereço, cidade/UF, unidade |
| **2. Dados do Instrumento** | Fabricante, modelo, tipo, classe de exatidão, nº série, capacidade, divisão, setor, periodicidade |
| **3. Informações do Procedimento** | Umidade, pressão, temperatura, unidade de massa, tipo calibração |
| **4. Rastreabilidade dos Padrões** | Tabela: ID peso, descrição, nº certificado, validade, acreditação |

**Página 2 — Resultados e Assinaturas:**

| Seção | Campos |
|-------|--------|
| **5. Resultados da Calibração** | Tabela: valor referência, indicação crescente/decrescente, erro, incerteza expandida, fator k |
| **6. Declaração de Conformidade** | Maior incerteza vs desvio máximo vs desvio permissível |
| **7. Observações** | Texto livre |
| **8. Legenda** | Abreviações (VN, VR, LP, VML, etc.) |
| **Datas** | Data calibração, data emissão, próxima calibração |
| **Assinatura** | Nome + imagem da assinatura do responsável técnico |

**Anexo 1 — Ensaio de Excentricidade:**
Tabela com posições na plataforma, cargas, indicações e cálculos de erro por posição.

### Requisitos do Certificado

| Campo | Obrigatório | Detalhe |
|-------|-------------|---------|
| Número sequencial | ✅ | Por empresa (CNPJ). Ponto de partida configurável |
| Dados do equipamento | ✅ | Tipo, marca, modelo, série, capacidade, resolução, classe, divisão |
| Condições ambientais | ✅ | Temperatura, umidade, pressão |
| Padrões utilizados (pesos) | ✅ | Quais pesos + certificados dos pesos + validade |
| Incerteza de medição | ✅ | Conforme ISO 17025, com fator k |
| Resultados das medições | ✅ | Valores crescente, decrescente, erro calculado |
| Declaração de conformidade | ✅ | Comparação desvio máximo vs permissível |
| Ensaio de excentricidade | ✅ | Anexo separado com posições na plataforma |
| Rastreabilidade | ✅ | Cadeia de rastreabilidade dos padrões |
| Responsável técnico | ✅ | Nome + imagem da assinatura |
| Assinatura do cliente | ✅ | Colhida digitalmente em campo |

### Pesos Padrão (Não são "Equipamentos")

| Item | Detalhe |
|------|---------|
| **O que são** | Massas de referência usados na calibração das balanças |
| **NÃO são equipamentos** | São cadastro/entidade separada |
| **Têm certificado próprio** | Com validade controlada |
| **Técnico seleciona na OS** | Quais pesos usou naquela calibração |
| **Referência cruzada** | Certificado da balança referencia os certificados dos pesos |
| **Controle de validade** | Alerta quando certificado do peso está vencendo |

> **ATENÇÃO:** O checklist é **pré-requisito** para gerar o certificado. Sem checklist preenchido = sem certificado.

---

> **Última atualização:** 15/02/2026
> **Próximo arquivo:** `ALINHAMENTO_02_TECNICO_MOTORISTA.md`
