#!/bin/bash
set -euo pipefail

# =============================================================================
# Setup Git no Servidor de Produção (executar UMA VEZ)
# =============================================================================
# Este script configura o repositório Git no servidor para receber deploys.
#
# Pré-requisitos:
#   1. Servidor já configurado com Docker (via setup-server.sh)
#   2. Chave SSH do servidor adicionada como Deploy Key no GitHub
#
# Uso (no servidor via SSH):
#   bash /root/sistema/deploy/setup-git-server.sh
#
# Ou remotamente (do PC):
#   ssh -i ~/.ssh/id_ed25519 root@178.156.176.145 "bash /root/sistema/deploy/setup-git-server.sh"
# =============================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

SISTEMA_DIR="/root/sistema"
BACKUP_DIR="/root/backups"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Kalibrium - Setup Git no Servidor       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# --- 1. Criar diretórios ---
log "Criando diretórios..."
mkdir -p "$BACKUP_DIR"
mkdir -p /root/.ssh

# --- 2. Gerar chave SSH para o servidor (se não existir) ---
if [ ! -f /root/.ssh/id_ed25519 ]; then
    log "Gerando chave SSH para o servidor..."
    ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519 -N "" -C "kalibrium-server"
    echo ""
    warn "==========================================================="
    warn "AÇÃO NECESSÁRIA: Adicione esta chave como Deploy Key no GitHub!"
    warn "==========================================================="
    echo ""
    info "Chave pública:"
    cat /root/.ssh/id_ed25519.pub
    echo ""
    info "Passos:"
    info "  1. Vá em: GitHub → Repositório → Settings → Deploy Keys"
    info "  2. Clique 'Add deploy key'"
    info "  3. Nome: 'Kalibrium Server'"
    info "  4. Cole a chave acima"
    info "  5. Marque 'Allow write access' (NÃO é necessário, read-only é suficiente)"
    info "  6. Clique 'Add key'"
    echo ""
    read -p "Pressione ENTER após adicionar a chave no GitHub..." _
else
    log "Chave SSH já existe."
fi

# --- 3. Configurar SSH para GitHub ---
if ! grep -q "github.com" /root/.ssh/config 2>/dev/null; then
    log "Configurando SSH para GitHub..."
    cat >> /root/.ssh/config <<'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile /root/.ssh/id_ed25519
    StrictHostKeyChecking no
EOF
    chmod 600 /root/.ssh/config
fi

# --- 4. Testar conexão com GitHub ---
log "Testando conexão com GitHub..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    log "Conexão com GitHub OK!"
else
    warn "Não foi possível autenticar com GitHub. Verifique se a Deploy Key foi adicionada."
fi

# --- 5. Configurar repositório Git ---
if [ -d "$SISTEMA_DIR/.git" ]; then
    log "Repositório Git já existe em $SISTEMA_DIR"
    cd "$SISTEMA_DIR"
    git remote -v
else
    warn "Repositório Git não encontrado em $SISTEMA_DIR"
    echo ""
    info "Para clonar o repositório, execute:"
    info "  cd /root"
    info "  git clone git@github.com:SEU_USUARIO/SEU_REPO.git sistema"
    echo ""
    info "Ou se o código já está lá (via SCP), inicialize o Git:"
    info "  cd $SISTEMA_DIR"
    info "  git init"
    info "  git remote add origin git@github.com:SEU_USUARIO/SEU_REPO.git"
    info "  git fetch origin"
    info "  git checkout -b main origin/main"
fi

# --- 6. Configurar Git global ---
git config --global user.name "Kalibrium Deploy" 2>/dev/null || true
git config --global user.email "deploy@kalibrium.local" 2>/dev/null || true

# --- 7. Tornar deploy.sh executável ---
if [ -f "$SISTEMA_DIR/deploy.sh" ]; then
    chmod +x "$SISTEMA_DIR/deploy.sh"
    log "deploy.sh marcado como executável"
fi

# --- 8. Instalar curl (para health checks) ---
if ! command -v curl >/dev/null 2>&1; then
    log "Instalando curl..."
    apt-get update -qq && apt-get install -y -qq curl
fi

echo ""
log "==========================================="
log "Setup concluído!"
log "==========================================="
echo ""
info "Próximos passos:"
info "  1. Configure backend/.env (copie de .env.example)"
info "  2. Crie .env na raiz (copie de .env.deploy-http.example)"
info "  3. Execute: ./deploy.sh --migrate"
echo ""
