# Kalibrium

Sistema de gestao completo para empresas de calibracao e servicos tecnicos de campo.

## Stack Tecnologica

### Backend
- **Framework:** Laravel 12 (PHP 8.2+)
- **Banco de Dados:** MySQL 8.0
- **Cache/Filas:** Redis
- **Autenticacao:** Laravel Sanctum
- **WebSockets:** Laravel Reverb
- **Permissoes:** Spatie Laravel Permission
- **Multi-tenant:** Suporte nativo

### Frontend
- **Framework:** React 19 + TypeScript 5.9
- **Build:** Vite 7
- **Estilizacao:** TailwindCSS 4 + Radix UI + shadcn/ui
- **Estado:** Zustand
- **Requisicoes:** Axios + TanStack Query
- **Roteamento:** React Router v7
- **Testes:** Vitest + Playwright

### Infraestrutura
- **Containerizacao:** Docker + Docker Compose
- **Web Server:** Nginx (reverse proxy + SSL)
- **Certificados:** Let's Encrypt (Certbot)
- **CI/CD:** GitHub Actions

---

## Modulos

| Modulo | Descricao |
|---|---|
| Ordens de Servico | CRUD, Kanban, contratos, SLA, checklists, assinaturas |
| Chamados Tecnicos | CRUD, mapa, agenda de tecnicos, historico |
| Orcamentos | CRUD, aprovacao, versionamento, conversao em OS |
| Financeiro | Contas a receber/pagar, comissoes, fluxo de caixa, conciliacao bancaria |
| Estoque | Dashboard, movimentacoes, armazens, inventarios, Kardex |
| Equipamentos | Calibracoes, certificados, pesos padrao |
| CRM | Pipeline de vendas, Customer 360, health score |
| INMETRO | Prospeccao, compliance, selos, concorrentes |
| Frota | Veiculos, GPS, abastecimento, pneus, inspecoes |
| RH | Ponto eletronico, ferias, organograma, recrutamento, desempenho |
| Qualidade | Procedimentos ISO, acoes corretivas, NPS |
| Automacao | Regras no-code, webhooks, relatorios agendados |
| Portal do Cliente | Dashboard, OS, orcamentos, chamados |
| Tech PWA | App mobile para tecnicos (offline-first) |
| TV Dashboard | Wallboard com KPIs em tempo real |
| Integracoes | Auvo, Email (IMAP), WhatsApp, Nuvem Fiscal |
| IA & Analise | Manutencao preditiva, churn, pricing, anomalias |

---

## Requisitos

- Docker e Docker Compose
- PHP 8.2+ (para desenvolvimento local sem Docker)
- Node.js 20+
- MySQL 8.0
- Redis

---

## Instalacao (Desenvolvimento)

### 1. Clone o repositorio

```bash
git clone <repo-url> && cd sistema
```

### 2. Backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 4. Com Docker (alternativa)

```bash
docker-compose up -d
```

Acesse:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- phpMyAdmin: http://localhost:8080

---

## Instalacao (Producao)

### 1. Configure as variaveis de ambiente

```bash
# Backend
cd backend && cp .env.example .env
# Edite .env com as credenciais de producao (DB, Redis, Mail, etc.)

# Frontend
cd frontend && cp .env.example .env
# Configure VITE_API_URL com a URL da API
```

### 2. Deploy com Docker

```bash
# Build e deploy
./deploy.sh

# Ou manualmente
docker-compose -f docker-compose.prod.yml up -d --build
```

### 3. Pos-deploy

```bash
docker-compose -f docker-compose.prod.yml exec app php artisan migrate --force
docker-compose -f docker-compose.prod.yml exec app php artisan config:cache
docker-compose -f docker-compose.prod.yml exec app php artisan route:cache
docker-compose -f docker-compose.prod.yml exec app php artisan view:cache
```

---

## Testes

### Backend
```bash
cd backend
php artisan test
php artisan test --coverage
```

### Frontend
```bash
cd frontend
npm run test
npm run test:coverage
npx playwright test  # E2E
```

---

## Variaveis de Ambiente Importantes

### Backend (.env)
| Variavel | Descricao |
|---|---|
| `APP_ENV` | `local` ou `production` |
| `APP_DEBUG` | `true` (dev) ou `false` (prod) |
| `DB_*` | Credenciais do MySQL |
| `REDIS_*` | Configuracao do Redis |
| `MAIL_*` | Configuracao de email (SMTP) |
| `REVERB_*` | Configuracao do WebSocket |

### Frontend (.env)
| Variavel | Descricao |
|---|---|
| `VITE_API_URL` | URL base da API (ex: `https://api.kalibrium.com/api/v1`) |
| `VITE_ERROR_REPORTING_URL` | URL do servico de monitoramento de erros (opcional) |

---

## Estrutura do Projeto

```
sistema/
├── backend/                 # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/   # 139+ controllers
│   │   ├── Models/                     # 197+ models
│   │   └── Services/                   # 55+ services
│   ├── database/migrations/            # 187+ migrations
│   ├── routes/api.php                  # 1347+ rotas
│   └── tests/                          # 152+ arquivos de teste
├── frontend/                # React SPA
│   ├── src/
│   │   ├── pages/           # 172+ paginas
│   │   ├── components/      # 116+ componentes
│   │   ├── hooks/           # Custom hooks
│   │   ├── stores/          # Zustand stores
│   │   └── lib/             # Utilitarios
│   └── tests/               # 37+ arquivos de teste
├── docker-compose.yml       # Desenvolvimento
├── docker-compose.prod.yml  # Producao
├── nginx/                   # Configuracao Nginx
├── deploy.sh               # Script de deploy
└── .github/workflows/ci.yml # CI/CD Pipeline
```

---

## CI/CD

O pipeline GitHub Actions executa automaticamente em push para `main` e `develop`:

1. **Backend Tests** - PHPUnit com MySQL real
2. **Frontend Build** - TypeScript check + build de producao
3. **E2E Tests** - Playwright com Chromium

---

## Licenca

Projeto proprietario. Todos os direitos reservados.
