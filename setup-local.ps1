<#
.SYNOPSIS
    Setup local do Sistema — SQLite (padrão) ou Docker MySQL.

.DESCRIPTION
    Configura o ambiente local completo em 1 comando.
    Roda migrations, seed, e deixa pronto para usar.

.PARAMETER Mode
    "sqlite" (padrão) ou "docker"

.EXAMPLE
    .\setup-local.ps1
    .\setup-local.ps1 -Mode docker
#>

param(
    [ValidateSet("sqlite", "docker")]
    [string]$Mode = "sqlite"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SETUP LOCAL — Modo: $($Mode.ToUpper())" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Copiar .env correto ───
$envSource = if ($Mode -eq "docker") { ".env.docker" } else { ".env.local" }
$envSourcePath = Join-Path $BackendDir $envSource
$envTargetPath = Join-Path $BackendDir ".env"

if (-not (Test-Path $envSourcePath)) {
    Write-Host "[ERRO] Arquivo $envSource nao encontrado em $BackendDir" -ForegroundColor Red
    exit 1
}

Copy-Item $envSourcePath $envTargetPath -Force
Write-Host "[OK] .env copiado de $envSource" -ForegroundColor Green

# ─── 2. Criar arquivo SQLite se necessário ───
if ($Mode -eq "sqlite") {
    $sqliteFile = Join-Path $BackendDir "database" "database.sqlite"
    if (-not (Test-Path $sqliteFile)) {
        New-Item -Path $sqliteFile -ItemType File -Force | Out-Null
        Write-Host "[OK] database.sqlite criado" -ForegroundColor Green
    } else {
        Write-Host "[OK] database.sqlite ja existe" -ForegroundColor Green
    }
}

# ─── 3. Docker (se modo docker) ───
if ($Mode -eq "docker") {
    Write-Host ""
    Write-Host "[...] Subindo MySQL via Docker..." -ForegroundColor Yellow

    $dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCheck) {
        Write-Host "[ERRO] Docker nao esta instalado. Instale Docker Desktop primeiro." -ForegroundColor Red
        Write-Host "       Download: https://www.docker.com/products/docker-desktop/" -ForegroundColor Gray
        exit 1
    }

    Push-Location $ProjectRoot
    docker compose up -d
    Pop-Location

    Write-Host "[OK] MySQL e PHPMyAdmin rodando" -ForegroundColor Green
    Write-Host "     MySQL:      localhost:3307" -ForegroundColor Gray
    Write-Host "     PHPMyAdmin: http://localhost:8080" -ForegroundColor Gray

    # Esperar MySQL ficar pronto
    Write-Host "[...] Aguardando MySQL inicializar (max 30s)..." -ForegroundColor Yellow
    $retries = 0
    $maxRetries = 15
    while ($retries -lt $maxRetries) {
        try {
            $result = docker exec sistema_mysql mysqladmin ping -h localhost -u root -proot 2>&1
            if ($result -match "alive") { break }
        } catch {}
        Start-Sleep -Seconds 2
        $retries++
    }
    if ($retries -ge $maxRetries) {
        Write-Host "[AVISO] MySQL pode ainda estar inicializando. Tente novamente em alguns segundos." -ForegroundColor Yellow
    } else {
        Write-Host "[OK] MySQL pronto!" -ForegroundColor Green
    }
}

# ─── 4. Backend: composer install ───
Write-Host ""
Write-Host "[...] Instalando dependencias do backend..." -ForegroundColor Yellow
Push-Location $BackendDir

$composerCheck = Get-Command composer -ErrorAction SilentlyContinue
if (-not $composerCheck) {
    # Tentar via php composer.phar
    $pharPath = Join-Path $BackendDir "composer.phar"
    if (Test-Path $pharPath) {
        php $pharPath install --no-interaction --prefer-dist
    } else {
        Write-Host "[ERRO] Composer nao encontrado. Instale: https://getcomposer.org/" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    composer install --no-interaction --prefer-dist
}
Write-Host "[OK] Dependencias do backend instaladas" -ForegroundColor Green

# ─── 5. Generate key (se necessário) ───
php artisan key:generate --force --no-interaction 2>$null
Write-Host "[OK] APP_KEY configurada" -ForegroundColor Green

# ─── 6. Limpar caches ───
php artisan config:clear 2>$null
php artisan cache:clear 2>$null
Write-Host "[OK] Caches limpos" -ForegroundColor Green

# ─── 7. Migrations + Seed ───
Write-Host ""
Write-Host "[...] Rodando migrations e seed..." -ForegroundColor Yellow
php artisan migrate:fresh --seed --force --no-interaction
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha nas migrations. Verifique o log acima." -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "[OK] Banco criado e populado com dados demo" -ForegroundColor Green

Pop-Location

# ─── 8. Frontend: npm install ───
Write-Host ""
Write-Host "[...] Instalando dependencias do frontend..." -ForegroundColor Yellow
Push-Location $FrontendDir

$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
    Write-Host "[AVISO] npm nao encontrado. Instale Node.js: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "        Voce pode instalar depois com: cd frontend && npm install" -ForegroundColor Gray
} else {
    npm install
    Write-Host "[OK] Dependencias do frontend instaladas" -ForegroundColor Green
}

Pop-Location

# ─── 9. Resumo final ───
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para iniciar o sistema:" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 1 (Backend):" -ForegroundColor Cyan
Write-Host "    cd backend" -ForegroundColor Gray
Write-Host "    php artisan serve" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 2 (Frontend):" -ForegroundColor Cyan
Write-Host "    cd frontend" -ForegroundColor Gray
Write-Host "    npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Acesse: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Login:" -ForegroundColor White
Write-Host "    Email: admin@sistema.local" -ForegroundColor Yellow
Write-Host "    Senha: password" -ForegroundColor Yellow
Write-Host ""
if ($Mode -eq "docker") {
    Write-Host "  PHPMyAdmin: http://localhost:8080" -ForegroundColor White
    Write-Host ""
}
