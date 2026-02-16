# =============================================================================
# Kalibrium ERP - Deploy para Produção (executar do Cursor/terminal local)
# =============================================================================
# Uso:
#   .\deploy-prod.ps1                    # Deploy sem migrations
#   .\deploy-prod.ps1 -Migrate           # Deploy com migrations (faz backup antes)
#   .\deploy-prod.ps1 -Migrate -Seed     # Deploy com migrations + seeders
#   .\deploy-prod.ps1 -Seed              # Apenas seeders
#   .\deploy-prod.ps1 -Rollback          # Rollback completo
#   .\deploy-prod.ps1 -Status            # Ver status do servidor
#   .\deploy-prod.ps1 -Logs              # Ver logs do backend
#   .\deploy-prod.ps1 -Backup            # Backup manual do banco
# =============================================================================

param(
    [switch]$Migrate,
    [switch]$Seed,
    [switch]$Rollback,
    [switch]$Status,
    [switch]$Logs,
    [switch]$Backup,
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

# --- Configuração do servidor ---
$SERVER_IP = "178.156.176.145"
$SERVER_USER = "root"
$REMOTE_DIR = "/root/sistema"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519"

function Write-Step { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[AVISO] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERRO] $msg" -ForegroundColor Red }

# =============================================================================
# Verificação de SSH
# =============================================================================
function Test-SSHConnection {
    Write-Step "Verificando conexão SSH"

    if (-not (Test-Path $SSH_KEY)) {
        Write-Err "Chave SSH não encontrada em: $SSH_KEY"
        Write-Host "Gere uma chave com: ssh-keygen -t ed25519" -ForegroundColor Yellow
        exit 1
    }

    $result = ssh -i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "echo ok" 2>&1
    if ($result -ne "ok") {
        Write-Err "Não foi possível conectar ao servidor $SERVER_IP"
        Write-Host "Verifique: 1) Servidor ligado 2) Chave SSH correta 3) Firewall" -ForegroundColor Yellow
        exit 1
    }

    Write-Ok "Conexão SSH OK ($SERVER_IP)"
}

# =============================================================================
# Git push local
# =============================================================================
function Push-ToGitHub {
    Write-Step "Enviando código para GitHub"

    $gitStatus = git status --porcelain 2>&1
    if ($gitStatus) {
        Write-Warn "Existem mudanças não commitadas:"
        Write-Host $gitStatus -ForegroundColor Yellow
        Write-Err "Faça commit antes de fazer deploy. Código sujo não será enviado."
        exit 1
    }

    $branch = git branch --show-current 2>&1
    if ($branch -ne "main") {
        Write-Warn "Você está na branch '$branch', não em 'main'."
        $confirm = Read-Host "Continuar mesmo assim? (s/N)"
        if ($confirm -ne "s") { exit 0 }
    }

    Write-Host "Fazendo push para origin/$branch..."
    git push origin $branch 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falha no git push. Verifique sua conexão e autenticação com o GitHub."
        exit 1
    }

    Write-Ok "Código enviado para GitHub"
}

# =============================================================================
# Execução remota via SSH
# =============================================================================
function Invoke-RemoteDeploy {
    param([string]$DeployArgs)

    Write-Step "Executando deploy no servidor"
    Write-Host "Servidor: $SERVER_IP" -ForegroundColor Gray
    Write-Host "Comando: ./deploy.sh $DeployArgs" -ForegroundColor Gray
    Write-Host ""

    ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "cd $REMOTE_DIR && bash deploy.sh $DeployArgs"
    $exitCode = $LASTEXITCODE

    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  DEPLOY CONCLUIDO COM SUCESSO!" -ForegroundColor Green
        Write-Host "  Acesse: http://$SERVER_IP" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
    } else {
        Write-Host "============================================" -ForegroundColor Red
        Write-Host "  DEPLOY FALHOU (exit code: $exitCode)" -ForegroundColor Red
        Write-Host "  Verifique os logs acima para detalhes." -ForegroundColor Red
        Write-Host "============================================" -ForegroundColor Red
        exit $exitCode
    }
}

# =============================================================================
# Main
# =============================================================================

Write-Host ""
Write-Host "=======================================" -ForegroundColor Blue
Write-Host "  Kalibrium ERP - Deploy Producao" -ForegroundColor Blue
Write-Host "=======================================" -ForegroundColor Blue

# Comandos que não precisam de git push
if ($Status) {
    Test-SSHConnection
    Invoke-RemoteDeploy "--status"
    exit 0
}

if ($Logs) {
    Test-SSHConnection
    Invoke-RemoteDeploy "--logs"
    exit 0
}

if ($Backup) {
    Test-SSHConnection
    Invoke-RemoteDeploy "--backup"
    exit 0
}

if ($Rollback) {
    Test-SSHConnection
    Write-Warn "ROLLBACK: Isso vai reverter o servidor para a versão anterior."
    $confirm = Read-Host "Tem certeza? (s/N)"
    if ($confirm -ne "s") {
        Write-Host "Rollback cancelado." -ForegroundColor Yellow
        exit 0
    }
    Invoke-RemoteDeploy "--rollback"
    exit 0
}

if ($Seed -and -not $Migrate) {
    Test-SSHConnection
    if (-not $SkipPush) { Push-ToGitHub }
    Invoke-RemoteDeploy "--seed"
    exit 0
}

# Deploy principal
Test-SSHConnection

if (-not $SkipPush) {
    Push-ToGitHub
}

$args_remote = ""
if ($Migrate) {
    $args_remote = "--migrate"
    Write-Warn "Deploy COM migrations (backup automático do banco será feito)"
}

Invoke-RemoteDeploy $args_remote
