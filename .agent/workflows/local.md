---
description: Setup local do sistema. Levanta backend + frontend com banco SQLite local.
---

# /local — Setup e Inicialização Local

// turbo-all

## Pré-requisitos

- PHP 8.2+ com extensões: sqlite3, pdo_sqlite, mbstring, openssl
- Composer
- Node.js 18+ e npm

---

## Setup Inicial (primeira vez ou reset)

1. Copiar o env local para .env:

```powershell
Copy-Item backend\.env.local backend\.env -Force
```

1. Criar o arquivo SQLite:

```powershell
if (-not (Test-Path backend\database\database.sqlite)) { New-Item backend\database\database.sqlite -ItemType File -Force }
```

1. Instalar dependências do backend:

```powershell
cd backend && composer install --no-interaction --prefer-dist
```

1. Gerar APP_KEY e limpar caches:

```powershell
cd backend && php artisan key:generate --force --no-interaction && php artisan config:clear && php artisan cache:clear
```

1. Rodar migrations com seed:

```powershell
cd backend && php artisan migrate:fresh --seed --force --no-interaction
```

1. Instalar dependências do frontend:

```powershell
cd frontend && npm install
```

---

## Iniciar o Sistema

1. Iniciar o backend (Terminal 1):

```powershell
cd backend && php artisan serve
```

1. Iniciar o frontend (Terminal 2):

```powershell
cd frontend && npm run dev
```

---

## Credenciais

- **URL:** <http://localhost:3000>
- **Email:** <admin@sistema.local>
- **Senha:** password

---

## Modo Docker (opcional)

Se precisar de MySQL real em vez de SQLite:

```powershell
Copy-Item backend\.env.docker backend\.env -Force
docker compose up -d
cd backend && php artisan migrate:fresh --seed --force --no-interaction
```

- **PHPMyAdmin:** <http://localhost:8080>
- **MySQL:** localhost:3307 (user=sistema, pass=sistema)
