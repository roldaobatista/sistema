<#
.SYNOPSIS
    Setup e inicializacao do ambiente local do Sistema.

.DESCRIPTION
    Script unico para levantar o ambiente de desenvolvimento local.
    Detecta servidores ja rodando, pula steps desnecessarios, e fornece feedback visual.

.PARAMETER Fresh
    Roda migrate:fresh --seed (apaga e recria o banco)

.PARAMETER SkipDeps
    Pula composer install e npm install

.PARAMETER Stop
    Para todos os servidores rodando

.PARAMETER Status
    Mostra o status dos servidores

.PARAMETER SetupOnly
    Apenas setup (deps + migrations), sem iniciar servidores

.EXAMPLE
    .\setup.ps1              # Setup completo + inicia servidores
    .\setup.ps1 -Fresh       # Reset do banco + inicia servidores
    .\setup.ps1 -SkipDeps    # Pula instalacao de dependencias
    .\setup.ps1 -Stop        # Para os servidores
    .\setup.ps1 -Status      # Mostra status
    .\setup.ps1 -SetupOnly   # Apenas setup, sem iniciar servidores
#>

param(
    [switch]$Fresh,
    [switch]$SkipDeps,
    [switch]$Stop,
    [switch]$Status,
    [switch]$SetupOnly
)

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$BackendPort = 8000
$FrontendPort = 3000
$EnvLocal = Join-Path $BackendDir ".env.local"
$EnvFile = Join-Path $BackendDir ".env"
$SqliteFile = Join-Path (Join-Path $BackendDir "database") "database.sqlite"

# --- Helpers ---
function Write-Step {
    param([string]$icon, [string]$msg)
    Write-Host "  $icon " -NoNewline
    Write-Host $msg
}

function Write-Header {
    param([string]$msg)
    Write-Host ""
    Write-Host "  =============================================" -ForegroundColor DarkGray
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "  =============================================" -ForegroundColor DarkGray
}

function Write-Ok {
    param([string]$msg)
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Skipped {
    param([string]$msg)
    Write-Host "  [SKIP] $msg" -ForegroundColor DarkYellow
}

function Write-Err {
    param([string]$msg)
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

function Write-Inf {
    param([string]$msg)
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
}

function Test-PortInUse {
    param([int]$port)
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn)
}

function Get-ProcessOnPort {
    param([int]$port)
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid_val = $conn.OwningProcess | Select-Object -First 1
        $proc = Get-Process -Id $pid_val -ErrorAction SilentlyContinue
        return $proc
    }
    return $null
}

function Stop-ServerOnPort {
    param([int]$port, [string]$name)
    $proc = Get-ProcessOnPort -port $port
    if ($proc) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Ok "$name parado (PID: $($proc.Id), porta $port)"
    }
    else {
        Write-Skipped "$name nao esta rodando na porta $port"
    }
}

# --- Prerequisites Check ---
function Test-Prerequisites {
    Write-Header "Verificando pre-requisitos"

    $allOk = $true

    # PHP
    $phpExe = Get-Command php -ErrorAction SilentlyContinue
    if ($phpExe) {
        $phpVer = & php -r "echo PHP_VERSION;" 2>$null
        Write-Step "[+]" "PHP: $phpVer"
    }
    else {
        Write-Err "PHP nao encontrado. Instale PHP 8.2+"
        $allOk = $false
    }

    # Composer
    $composerExe = Get-Command composer -ErrorAction SilentlyContinue
    if ($composerExe) {
        $composerVer = & composer --version 2>$null | Select-Object -First 1
        Write-Step "[+]" "Composer: $composerVer"
    }
    else {
        Write-Err "Composer nao encontrado."
        $allOk = $false
    }

    # Node
    $nodeExe = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeExe) {
        $nodeVer = & node -v 2>$null
        Write-Step "[+]" "Node: $nodeVer"
    }
    else {
        Write-Err "Node.js nao encontrado. Instale Node 18+"
        $allOk = $false
    }

    # npm
    $npmExe = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmExe) {
        $npmVer = & npm -v 2>$null
        Write-Step "[+]" "npm: $npmVer"
    }
    else {
        Write-Err "npm nao encontrado."
        $allOk = $false
    }

    if (-not $allOk) {
        Write-Host ""
        Write-Err "Pre-requisitos nao atendidos. Corrija os itens acima."
        exit 1
    }
}

# --- Status ---
function Show-Status {
    Write-Header "Status dos Servidores"

    if (Test-PortInUse -port $BackendPort) {
        $proc = Get-ProcessOnPort -port $BackendPort
        Write-Step "[ON]" "Backend  : rodando na porta $BackendPort (PID: $($proc.Id))"
    }
    else {
        Write-Step "[OFF]" "Backend  : parado"
    }

    if (Test-PortInUse -port $FrontendPort) {
        $proc = Get-ProcessOnPort -port $FrontendPort
        Write-Step "[ON]" "Frontend : rodando na porta $FrontendPort (PID: $($proc.Id))"
    }
    else {
        Write-Step "[OFF]" "Frontend : parado"
    }

    Write-Host ""
    Write-Inf "URL: http://localhost:$FrontendPort"
    Write-Inf "API: http://localhost:$BackendPort/api"
    Write-Host ""
}

# --- Stop ---
function Stop-All {
    Write-Header "Parando servidores"
    Stop-ServerOnPort -port $BackendPort -name "Backend (Laravel)"
    Stop-ServerOnPort -port $FrontendPort -name "Frontend (Vite)"
    Write-Host ""
}

# --- Setup Environment ---
function Initialize-Environment {
    Write-Header "Configurando ambiente"

    # .env
    if (-not (Test-Path $EnvFile)) {
        Copy-Item $EnvLocal $EnvFile -Force
        Write-Ok ".env criado a partir de .env.local"
    }
    else {
        Write-Skipped ".env ja existe"
    }

    # SQLite
    $sqliteDir = Split-Path $SqliteFile -Parent
    if (-not (Test-Path $sqliteDir)) {
        New-Item $sqliteDir -ItemType Directory -Force | Out-Null
    }
    if (-not (Test-Path $SqliteFile)) {
        New-Item $SqliteFile -ItemType File -Force | Out-Null
        Write-Ok "database.sqlite criado"
    }
    else {
        Write-Skipped "database.sqlite ja existe"
    }
}

# --- Install Dependencies ---
function Install-Deps {
    if ($SkipDeps) {
        Write-Header "Dependencias (pulando)"
        Write-Skipped "Flag -SkipDeps ativa"
        return
    }

    Write-Header "Instalando dependencias"

    # Backend
    $vendorDir = Join-Path $BackendDir "vendor"
    $composerLock = Join-Path $BackendDir "composer.lock"
    $needsBackend = $true

    if ((Test-Path $vendorDir) -and (Test-Path $composerLock)) {
        $vendorTime = (Get-Item $vendorDir).LastWriteTime
        $lockTime = (Get-Item $composerLock).LastWriteTime
        if ($vendorTime -ge $lockTime) {
            Write-Skipped "Backend deps atualizadas (vendor/ mais recente que composer.lock)"
            $needsBackend = $false
        }
    }

    if ($needsBackend) {
        Write-Step "[>>]" "Instalando dependencias do backend..."
        Push-Location $BackendDir
        try {
            & composer install --no-interaction --prefer-dist --quiet 2>$null
            Write-Ok "Backend deps instaladas"
        }
        catch {
            Write-Err "Falha ao instalar deps do backend: $($_.Exception.Message)"
        }
        finally {
            Pop-Location
        }
    }

    # Frontend
    $nodeModules = Join-Path $FrontendDir "node_modules"
    $packageLock = Join-Path $FrontendDir "package-lock.json"
    $needsFrontend = $true

    if ((Test-Path $nodeModules) -and (Test-Path $packageLock)) {
        $nmTime = (Get-Item $nodeModules).LastWriteTime
        $lockTime = (Get-Item $packageLock).LastWriteTime
        if ($nmTime -ge $lockTime) {
            Write-Skipped "Frontend deps atualizadas (node_modules/ mais recente que package-lock.json)"
            $needsFrontend = $false
        }
    }

    if ($needsFrontend) {
        Write-Step "[>>]" "Instalando dependencias do frontend..."
        Push-Location $FrontendDir
        try {
            & npm install --silent 2>$null
            Write-Ok "Frontend deps instaladas"
        }
        catch {
            Write-Err "Falha ao instalar deps do frontend: $($_.Exception.Message)"
        }
        finally {
            Pop-Location
        }
    }
}

# --- Laravel Setup ---
function Initialize-Laravel {
    Write-Header "Configurando Laravel"

    Push-Location $BackendDir

    try {
        # APP_KEY
        $envContent = Get-Content $EnvFile -Raw
        if ($envContent -match 'APP_KEY=\s*$' -or $envContent -match 'APP_KEY=$') {
            & php artisan key:generate --force --no-interaction 2>$null
            Write-Ok "APP_KEY gerada"
        }
        else {
            Write-Skipped "APP_KEY ja existe"
        }

        # Clear caches
        & php artisan config:clear --quiet 2>$null
        & php artisan cache:clear --quiet 2>$null
        & php artisan route:clear --quiet 2>$null
        Write-Ok "Caches limpos"

        # Migrations
        if ($Fresh) {
            Write-Step "[DB]" "Rodando migrate:fresh --seed..."
            & php artisan migrate:fresh --seed --force --no-interaction 2>$null
            Write-Ok "Banco recriado com seeds"
        }
        else {
            Write-Step "[DB]" "Rodando migrate..."
            & php artisan migrate --force --no-interaction 2>$null
            Write-Ok "Migrations aplicadas"
        }
    }
    finally {
        Pop-Location
    }
}

# --- Start Servers ---
function Start-Servers {
    Write-Header "Iniciando servidores"

    # Backend
    if (Test-PortInUse -port $BackendPort) {
        Write-Skipped "Backend ja rodando na porta $BackendPort"
    }
    else {
        Write-Step "[>>]" "Iniciando backend na porta $BackendPort..."
        Start-Process -FilePath "php" -ArgumentList "artisan", "serve", "--port=$BackendPort" -WorkingDirectory $BackendDir -WindowStyle Hidden
        Start-Sleep -Seconds 2
        if (Test-PortInUse -port $BackendPort) {
            Write-Ok "Backend rodando em http://localhost:$BackendPort"
        }
        else {
            Write-Err "Backend nao iniciou. Verifique os logs."
        }
    }

    # Frontend
    if (Test-PortInUse -port $FrontendPort) {
        Write-Skipped "Frontend ja rodando na porta $FrontendPort"
    }
    else {
        Write-Step "[>>]" "Iniciando frontend na porta $FrontendPort..."
        Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $FrontendDir -WindowStyle Hidden
        Start-Sleep -Seconds 3
        if (Test-PortInUse -port $FrontendPort) {
            Write-Ok "Frontend rodando em http://localhost:$FrontendPort"
        }
        else {
            Write-Err "Frontend nao iniciou. Verifique os logs."
        }
    }
}

# --- Show Final Info ---
function Show-Ready {
    Write-Host ""
    Write-Host "  +=============================================+" -ForegroundColor Green
    Write-Host "  |          SISTEMA PRONTO!                    |" -ForegroundColor Green
    Write-Host "  +=============================================+" -ForegroundColor Green
    Write-Host "  |  App:   http://localhost:$FrontendPort               |" -ForegroundColor Green
    Write-Host "  |  API:   http://localhost:$BackendPort/api            |" -ForegroundColor Green
    Write-Host "  |  Login: admin@sistema.local                 |" -ForegroundColor Green
    Write-Host "  |  Senha: password                            |" -ForegroundColor Green
    Write-Host "  +=============================================+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Comandos uteis:" -ForegroundColor DarkGray
    Write-Host "    .\setup.ps1 -Stop      -- Para tudo" -ForegroundColor DarkGray
    Write-Host "    .\setup.ps1 -Status    -- Ver status" -ForegroundColor DarkGray
    Write-Host "    .\setup.ps1 -Fresh     -- Reset do banco" -ForegroundColor DarkGray
    Write-Host ""
}

# --- Main ---
Write-Host ""
Write-Host "  Sistema Local Setup" -ForegroundColor Cyan
Write-Host "  ---------------------" -ForegroundColor DarkGray

if ($Status) {
    Show-Status
    exit 0
}

if ($Stop) {
    Stop-All
    exit 0
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()

Test-Prerequisites
Initialize-Environment
Install-Deps
Initialize-Laravel

if (-not $SetupOnly) {
    Start-Servers
    $sw.Stop()
    Write-Host ""
    Write-Inf "Setup completo em $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    Show-Ready
}
else {
    $sw.Stop()
    Write-Host ""
    Write-Inf "Setup completo em $([math]::Round($sw.Elapsed.TotalSeconds, 1))s (servidores nao iniciados)"
    Write-Host "  Para iniciar: " -NoNewline
    Write-Host ".\setup.ps1" -ForegroundColor Yellow
    Write-Host ""
}
