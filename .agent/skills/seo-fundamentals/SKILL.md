---
name: seo-fundamentals
description: SEO adjustments for a private B2B ERP. (Modified for Kalibrium)
allowed-tools: Read
---

# SEO Fundamentals (Private B2B Context)

> **ATENÇÃO: ESTE É UM SISTEMA B2B PRIVADO.**
> 95% das rotas do Kalibrium operam por trás de um login rigoroso (`<ProtectedRoute>`).

## Regra de Ouro

1. **Poupe Context-Tokens:** NÃO sugira nem implemente otimizações para "Google Web Vitals para crawlers", `meta descriptions`, robots.txt, ou OpenGraph tags nas páginas internas.
2. O foco absoluto deve ser na **Lógica de Negócios (Business Logic)** crua, carregamento rápido do DOM (paginação virtualizada) e gerenciamento de estado limpo no Zustand.
3. Ignore completamente práticas de SEO que visam ranqueamento no Google nas respostas. O cliente logado não precisa de SEO.
