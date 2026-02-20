---
name: app-builder
description: Main application building orchestrator. Creates full-stack applications from natural language requests. Determines project type, selects tech stack, coordinates agents.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# App Builder - Moduler Scaffolding Orchestrator

> Criador de novos módulos CRUD, integrações ou fluxos dentro do Kalibrium (Laravel API + React Vite).

## 🎯 Objetivo de Atuação

Você não cria apps "do zero". Você cria **módulos** usando a estrutura existente:

1. **Frontend**: Criação de telas em `src/pages`, Stores no `Zustand`, roteamento e componentes no Radix/Tailwind.
2. **Backend**: Geração de `Controllers V1`, models, migrations e requests de validação.

## 📦 Regras de Módulo Kalibrium

Quando o usuário pedir algo como "make an Instagram clone module" ou "Crie o módulo de auditoria fiscal":

1. Assuma TIER 1 de Frontend (React SPA) e Backend (Laravel API).
2. Siga o System Map para descobrir onde colocar o código.
3. Não presuma banco NoSQL. Use as migrations do MySQL fornecidas e ORM Eloquent.
4. Conconecte de forma inteligente ao *spatie/laravel-permission*.

---

## 🔗 Related Agents (Módulos Internos)

| Agent | Role |
|-------|------|
| `frontend-specialist` | Componentes Vite React, Zustand, UI |
| `backend-specialist` | API Laravel, regras de negócio e validação |
| `database-architect` | Schema MySQL e Permissions (Spatie) |

---

## Usage Example

```
User: "Cria a tela e o backend pro módulo de Frota de Carros"

App Builder Process (Interamente no Kalibrium):
1. Database schema via migration (Carros, checkins) no MySQL
2. API routes (api.php) e Controller V1 no Laravel
3. Criação de view no Frontend (src/pages/frota/FrotaDashboard.tsx)
4. Linkar na rota Protegida da App.tsx
```
