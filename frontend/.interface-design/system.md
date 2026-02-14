# Kalibrium Design System — system.md

> **Direção:** Laboratório de Controle Digital
> **Sensação:** Confiança técnica com calor humano
> **Inspirações:** Linear (organização) × Notion (acolhimento) × Terminal de negociação (densidade)

---

## Intenção

**Quem:** Gestores, técnicos e administradores de empresas de calibração/metrologia. Abrem o sistema no escritório ou no laboratório, entre atendimentos. Precisam de informação rápida e confiável.

**O que fazem:** Acompanhar ordens de serviço, controlar finanças, monitorar equipamentos, gerenciar agenda de técnicos. Velocidade e precisão importam.

**Como deve sentir:** Como abrir um notebook num laboratório bem organizado. Inox escovado, displays LED azulados, tudo no lugar. Confiança nos números. Sem ruído visual.

---

## Paleta de Cores

### Brand — Azul-Instrumento (hue 245)

Extraído dos displays LED de equipamentos de medição. Frio mas confiável.

```
brand-50:  oklch(0.97 0.01 245)   — tinted backgrounds
brand-100: oklch(0.93 0.03 245)   — hover tints
brand-200: oklch(0.86 0.06 245)   — light accents
brand-500: oklch(0.55 0.18 245)   — primary action
brand-600: oklch(0.47 0.18 245)   — logo, primary buttons
brand-700: oklch(0.40 0.15 245)   — active child nav
brand-800: oklch(0.33 0.12 245)   — mono data emphasis
brand-900: oklch(0.27 0.09 245)   — deep accent
```

### Surface — Grafite (hue 260, chroma ~0.008)

Bancadas metálicas, racks, carcaças de instrumentos. Quase neutro com calor sutil.

```
surface-0:   oklch(1 0 0)           — cards, sidebar, topbar
surface-50:  oklch(0.985 0.003 260) — page background
surface-100: oklch(0.965 0.005 260) — hover, secondary bg
surface-200: oklch(0.925 0.008 260) — dividers
surface-400: oklch(0.70 0.008 260)  — icons inativos
surface-500: oklch(0.55 0.008 260)  — texto terciário
surface-600: oklch(0.44 0.008 260)  — texto secundário, nav items
surface-700: oklch(0.37 0.008 260)  — labels, texto de suporte
surface-800: oklch(0.27 0.008 260)  — texto forte
surface-900: oklch(0.20 0.008 260)  — texto primário, headings
```

### Semânticas — Sinais de Calibração

```
success: oklch(0.60 0.17 145)  — aprovado, dentro da tolerância
warning: oklch(0.75 0.15 75)   — atenção, próximo do limite
danger:  oklch(0.55 0.20 27)   — fora de tolerância, reprovado
info:    oklch(0.60 0.15 245)  — informativo, neutro
```

---

## Tipografia

```
Sans:  'Inter', system-ui
Mono:  'JetBrains Mono', 'Fira Code', ui-monospace
```

### Hierarquia de Texto (4 níveis — SEMPRE usar)

| Nível | Classe | Uso |
|-------|--------|-----|
| **Primário** | `text-surface-900` | Títulos, valores, dados principais |
| **Secundário** | `text-surface-600` | Nav items, body text, labels |
| **Terciário** | `text-surface-500` | Subtítulos, texto de apoio |
| **Silenciado** | `text-surface-400` | Metadados, hints, placeholders |

### Escala

| Contexto | Classes |
|----------|---------|
| Page title | `text-lg font-semibold text-surface-900 tracking-tight` |
| Page subtitle | `text-[13px] text-surface-500` |
| Section title | `text-[13px] font-semibold text-surface-900` |
| Table header | `text-[11px] font-semibold text-surface-500 uppercase tracking-wider` |
| Table cell | `text-[13px] text-surface-700` |
| Table cell (mono) | `font-mono text-[12px] font-semibold text-brand-600 tabular-nums` |
| Label | `text-[13px] font-medium text-surface-700` |
| KPI label | `text-[11px] font-medium text-surface-500 uppercase tracking-wider` |
| KPI value hero | `text-3xl font-bold text-surface-900 tabular-nums tracking-tight` |
| KPI value inline | `text-[15px] font-semibold text-surface-900 tabular-nums` |
| Small meta | `text-[11px] text-surface-400` |

---

## Profundidade

### Estratégia: Bordas RGBA (NÃO sombras)

A hierarquia visual é criada por opacidade de borda, não por sombras dramáticas.

```
border-subtle:   oklch(0 0 0 / 0.06)  — separadores internos, sub-nav tree lines
border-default:  oklch(0 0 0 / 0.09)  — cards, sidebar, topbar, tabelas
border-emphasis: oklch(0 0 0 / 0.14)  — hover states, destaques
border-strong:   oklch(0 0 0 / 0.20)  — focus rings, active borders
```

### Sombras (mínimas — apenas para sobreposição)

```
shadow-card:     0 1px 2px oklch(0 0 0 / 0.04)        — cards no layout
shadow-elevated: 0 2px 8px oklch(0 0 0 / 0.08)        — dropdowns, popovers
shadow-modal:    0 8px 32px oklch(0 0 0 / 0.16)       — modals
```

---

## Espaçamento

### Base: 4px

```
0.5 = 2px   — micro (entre ícone e borda)
1   = 4px   — tight (letter spacing visual)
1.5 = 6px   — pares de elementos relacionados
2   = 8px   — dentro de componentes (padding interno)
2.5 = 10px  — cells de tabela (py-2.5)
3   = 12px  — gap entre cards, entre seções pequenas
3.5 = 14px  — padding de cards
4   = 16px  — padding de página (mobile)
5   = 20px  — padding de página (desktop), gap entre seções
```

---

## Border Radius

### Estratégia: Tight/Técnico

```
radius-xs:  0.25rem (4px)   — badges, indicadores
radius-sm:  0.375rem (6px)  — inputs, buttons sm
radius-md:  0.5rem (8px)    — buttons md, cards internos
radius-lg:  0.625rem (10px) — cards principais
radius-xl:  0.75rem (12px)  — cards hero, modals menores
radius-2xl: 1rem (16px)     — modals grandes (máximo)
```

> ⚠️ Nunca usar radius > 1rem. Laboratórios não são "bubbly".

---

## Assinatura — Barra de Tolerância

O elemento visual único do Kalibrium. Três faixas segmentadas que representam:

- **Verde** = dentro da tolerância / OK / concluído
- **Âmbar** = próximo do limite / atenção / em andamento
- **Vermelho** = fora de tolerância / vencido / crítico

```jsx
<div className="flex gap-0.5">
  <div className="h-1 flex-[3] rounded-l-full bg-emerald-400/70" />
  <div className="h-1 flex-[1] bg-amber-400/70" />
  <div className="h-1 flex-[1] rounded-r-full bg-red-400/70" />
</div>
```

**Onde usar:** KPI cards (OS), equip. próximos de calibração, SLA, progresso financeiro, checklists.

---

## Padrões de Componentes

### Page Header

```jsx
<div>
  <h1 className="text-lg font-semibold text-surface-900 tracking-tight">
    {title}
  </h1>
  {subtitle && (
    <p className="mt-0.5 text-[13px] text-surface-500">{subtitle}</p>
  )}
</div>
```

Botão de ação primária: canto superior direito, `Button variant="primary" size="sm"`.

### Tabela — Density Padrão

```
Header:  px-4 py-2.5 — text-[11px] font-semibold text-surface-500 uppercase tracking-wider
Cell:    px-4 py-2.5 — text-[13px] text-surface-700
Row:     hover:bg-surface-50 transition-colors duration-100
```

### Card com Header

```jsx
<div className="rounded-xl border border-default bg-surface-0 shadow-card">
  <div className="px-4 py-3 border-b border-subtle">
    <h3 className="text-[13px] font-semibold text-surface-900">{title}</h3>
  </div>
  <div className="p-4">{children}</div>
</div>
```

### Empty State

```jsx
<div className="py-10 text-center">
  <Icon className="mx-auto h-6 w-6 text-surface-300" />
  <p className="mt-1.5 text-[13px] text-surface-400">{message}</p>
  {action && (
    <Button variant="outline" size="sm" className="mt-3" onClick={action.onClick}>
      {action.label}
    </Button>
  )}
</div>
```

### Loading Skeleton

Grid de retângulos com `skeleton` utility class. Nunca "Carregando..." em texto plain.

### Formulário em Modal

```
Grid: gap-4 sm:grid-cols-2
Labels: text-[13px] font-medium text-surface-700
Inputs: bg-surface-50, border-default, focus ring brand
Botões: justify-end gap-2 — Cancel (outline) + Submit (primary)
Submit disabled + spinner durante loading
```

---

## Navegação

### Sidebar

- **Fundo:** Mesmo da topbar e cards (`surface-0`). Sem cor diferente.
- **Separação:** Borda sutil `border-default` apenas.
- **Active item:** `bg-surface-100 text-surface-900` + barra vertical `bg-brand-500` (2px, left).
- **Active child:** `bg-brand-50 text-brand-700`.
- **Ícones inativos:** `text-surface-400`, hover `text-surface-600`.
- **Sub-items:** Indentados com tree line `border-l border-subtle`.

### Topbar

- **Fundo:** `surface-0`, com `border-b border-default`.
- **Altura:** `3.25rem` (52px) — compacta.

---

## Animações

```
Duração:  150-300ms (nunca > 500ms)
Easing:   cubic-bezier(0.16, 1, 0.3, 1) — ease-out
          cubic-bezier(0.4, 0, 0.2, 1)  — ease-smooth
Spring/Bounce: NUNCA em interfaces profissionais
```

### Padrões

| Ação | Animação |
|------|----------|
| Hover | `transition-colors duration-100` |
| Modal enter | `animate-scale-in` (200ms) |
| Content enter | `animate-slide-up` (300ms) |
| Skeleton loading | `animate-shimmer` (1500ms loop) |

---

## Anti-Padrões (PROIBIDO)

- ❌ Radius > 1rem em qualquer componente
- ❌ Sombras dramáticas (drop-shadow grande)
- ❌ Ícones como decoração (ícone sem significado = remover)
- ❌ Cards todos idênticos em dashboards
- ❌ "Carregando..." em texto (usar skeleton)
- ❌ Empty state sem ícone ou CTA
- ❌ Bordas hexagonais sólidas (usar RGBA)
- ❌ Gradientes decorativos
- ❌ Cores sem propósito semântico
- ❌ Purple/violet em qualquer lugar
- ❌ Spring/bounce animations
- ❌ Sidebar com cor de fundo diferente do conteúdo
