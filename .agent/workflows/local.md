---
description: Setup local do sistema. Levanta backend + frontend com banco SQLite local.
---

# /local — Setup e Inicialização Local

// turbo-all

## Modo Rápido (Padrão)

O script `setup.ps1` faz TUDO automaticamente: verifica pré-requisitos, instala dependências (se necessário), configura o banco, e levanta os servidores.

1. Executar o setup completo:

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

## Opções

| Comando | Descrição |
|---------|-----------|
| `powershell -ExecutionPolicy Bypass -File setup.ps1` | Setup completo + inicia servidores |
| `powershell -ExecutionPolicy Bypass -File setup.ps1 -Fresh` | Reset do banco (migrate:fresh --seed) |
| `powershell -ExecutionPolicy Bypass -File setup.ps1 -SkipDeps` | Pula composer/npm install |
| `powershell -ExecutionPolicy Bypass -File setup.ps1 -Stop` | Para todos os servidores |
| `powershell -ExecutionPolicy Bypass -File setup.ps1 -Status` | Mostra status dos servidores |
| `powershell -ExecutionPolicy Bypass -File setup.ps1 -Setup` | Apenas setup, sem iniciar servidores |

## Credenciais

- **URL:** <http://localhost:3000>
- **Email:** <admin@sistema.local>
- **Senha:** password

## Setup Manual (caso o script falhe)

1. Copiar env:

```powershell
Copy-Item backend\.env.local backend\.env -Force
```

1. Criar SQLite:

```powershell
if (-not (Test-Path backend\database\database.sqlite)) { New-Item backend\database\database.sqlite -ItemType File -Force }
```

1. Backend deps:

```powershell
Set-Location backend; composer install --no-interaction --prefer-dist
```

1. Key + caches:

```powershell
Set-Location backend; php artisan key:generate --force --no-interaction; php artisan config:clear; php artisan cache:clear
```

1. Migrations:

```powershell
Set-Location backend; php artisan migrate:fresh --seed --force --no-interaction
```

1. Frontend deps:

```powershell
Set-Location frontend; npm install
```

1. Backend (Terminal 1):

```powershell
Set-Location backend; php artisan serve
```

1. Frontend (Terminal 2):

```powershell
Set-Location frontend; npm run dev
```

## Docker (opcional)

```powershell
Copy-Item backend\.env.docker backend\.env -Force
docker compose up -d
Set-Location backend; php artisan migrate:fresh --seed --force --no-interaction
```
