#!/bin/bash
set -euo pipefail

# =============================================================================
# Kalibrium ERP - Deploy Profissional
# =============================================================================
# Usage:
#   ./deploy.sh                  # Deploy sem migrations
#   ./deploy.sh --migrate        # Deploy com migrations + seeders
#   ./deploy.sh --seed           # Seeders apenas (permissões)
#   ./deploy.sh --rollback       # Rollback completo (código + banco)
#   ./deploy.sh --init-ssl       # Setup inicial SSL (Let's Encrypt)
#   ./deploy.sh --status         # Status dos containers
#   ./deploy.sh --logs           # Últimas 100 linhas de log
#   ./deploy.sh --backup         # Backup manual do banco
# =============================================================================

# --- Configuração ---
BACKUP_DIR="/root/backups"
BACKUP_RETENTION_DAYS=7
HEALTH_CHECK_RETRIES=15
HEALTH_CHECK_INTERVAL=4
MYSQL_WAIT_RETRIES=30
MYSQL_WAIT_INTERVAL=3

# Auto-detecta compose file (HTTP se não tem SSL, HTTPS se tem)
if [ -d "certbot/conf/live" ] && [ "$(ls -A certbot/conf/live 2>/dev/null)" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.prod-http.yml"
fi

DOMAIN="${DOMAIN:-}"
EMAIL="${CERTBOT_EMAIL:-admin@your-domain.com}"
DEPLOY_TAG="$(date +%Y%m%d_%H%M%S)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# =============================================================================
# PRE-FLIGHT: Validações antes de tudo (segurança em produção)
# =============================================================================
preflight() {
    step "ETAPA 1/6: Verificações pré-deploy"

    command -v docker >/dev/null 2>&1 || error "Docker não instalado"
    command -v docker compose >/dev/null 2>&1 || error "Docker Compose não instalado"

    [ -f "$COMPOSE_FILE" ] || error "$COMPOSE_FILE não encontrado"
    [ -f "backend/.env" ] || error "backend/.env não encontrado. Copie de backend/.env.example e configure."

    # CORS: sem placeholder
    if grep -q 'CORS_ALLOWED_ORIGINS=https://seu-dominio.com.br' backend/.env 2>/dev/null; then
        error "CORS_ALLOWED_ORIGINS ainda tem valor placeholder em backend/.env!"
    fi

    # Produção: APP_ENV deve ser production
    local app_env
    app_env=$(grep -oP '^APP_ENV=\K.*' backend/.env 2>/dev/null | tr -d '\r' || echo "")
    if [ -n "$app_env" ] && [ "$app_env" != "production" ]; then
        error "backend/.env deve ter APP_ENV=production em produção (atual: APP_ENV=$app_env)"
    fi

    # Produção: APP_DEBUG deve ser false
    local app_debug
    app_debug=$(grep -oP '^APP_DEBUG=\K.*' backend/.env 2>/dev/null | tr -d '\r' || echo "true")
    if [ "$app_debug" = "true" ]; then
        error "backend/.env deve ter APP_DEBUG=false em produção (segurança)"
    fi

    # Espaço em disco
    local disk_available
    disk_available=$(df -m / | awk 'NR==2{print $4}')
    if [ "$disk_available" -lt 500 ]; then
        error "Espaço em disco insuficiente: ${disk_available}MB disponível (mínimo: 500MB)"
    fi

    mkdir -p "$BACKUP_DIR"

    log "Verificações OK (compose: $COMPOSE_FILE, APP_ENV=$app_env, disco: ${disk_available}MB livres)"
}

# =============================================================================
# GIT PULL: Atualiza código do repositório
# =============================================================================
git_pull() {
    step "ETAPA 2/6: Atualizando código via Git"

    if [ ! -d ".git" ]; then
        warn "Repositório Git não encontrado. Pulando git pull."
        return 0
    fi

    local current_commit
    current_commit=$(git rev-parse --short HEAD)
    log "Commit atual: $current_commit"

    # Backup dos .env antes do reset (eles têm config de produção)
    log "Salvando .env de produção..."
    [ -f "backend/.env" ] && cp backend/.env /root/backend-env-backup 2>/dev/null || true
    [ -f ".env" ] && cp .env /root/root-env-backup 2>/dev/null || true
    [ -f "frontend/.env" ] && cp frontend/.env /root/frontend-env-backup 2>/dev/null || true

    git fetch origin main 2>/dev/null || warn "Não foi possível fazer fetch (sem internet?)"

    local local_hash remote_hash
    local_hash=$(git rev-parse HEAD)
    remote_hash=$(git rev-parse origin/main 2>/dev/null || echo "$local_hash")

    if [ "$local_hash" = "$remote_hash" ]; then
        log "Código já está atualizado."
        return 0
    fi

    # Servidor de deploy: código deve ser idêntico ao origin/main
    # Alterações locais no servidor são descartadas (config fica em .env, que é gitignored)
    git reset --hard origin/main || error "Falha no git reset. Verifique o repositório."

    # Restaura .env de produção (podem ter sido sobrescritos pelo reset)
    log "Restaurando .env de produção..."
    [ -f "/root/backend-env-backup" ] && cp /root/backend-env-backup backend/.env 2>/dev/null || true
    [ -f "/root/root-env-backup" ] && cp /root/root-env-backup .env 2>/dev/null || true
    [ -f "/root/frontend-env-backup" ] && cp /root/frontend-env-backup frontend/.env 2>/dev/null || true

    local new_commit
    new_commit=$(git rev-parse --short HEAD)
    log "Atualizado: $current_commit → $new_commit"
}

# =============================================================================
# BACKUP: Dump do banco MySQL antes de migrations
# =============================================================================
backup_database() {
    step "ETAPA 3/6: Backup do banco de dados"

    local db_container="kalibrium_mysql"

    if ! docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
        warn "Container MySQL não está rodando. Pulando backup."
        return 0
    fi

    local db_name db_user db_pass
    db_name=$(grep -oP '^DB_DATABASE=\K.*' backend/.env | tail -1 | tr -d '\r' || echo "kalibrium")
    db_user=$(grep -oP '^DB_USERNAME=\K.*' backend/.env | tail -1 | tr -d '\r' || echo "kalibrium")
    db_pass=$(grep -oP '^DB_PASSWORD=\K.*' backend/.env | tail -1 | tr -d '\r' || echo "")

    local safe_tag
    safe_tag=$(echo "$DEPLOY_TAG" | tr -dc '0-9_')
    local backup_file="${BACKUP_DIR}/kalibrium_${safe_tag}.sql.gz"

    log "Fazendo backup de '${db_name}'..."

    if docker exec -e MYSQL_PWD="$db_pass" "$db_container" mysqldump \
        -u"$db_user" \
        --single-transaction --quick --lock-tables=false \
        "$db_name" 2>/dev/null | gzip > "$backup_file"; then

        local backup_size
        backup_size=$(du -h "$backup_file" | cut -f1)
        log "Backup salvo: $backup_file ($backup_size)"
        echo "$backup_file" > "${BACKUP_DIR}/.latest"
    else
        rm -f "$backup_file"
        error "Falha no backup do banco! Deploy abortado por segurança."
    fi

    # Rotação de backups antigos
    find "$BACKUP_DIR" -name "kalibrium_*.sql.gz" -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -name "kalibrium_*.sql.gz" | wc -l)
    info "Backups mantidos: $backup_count (retenção: ${BACKUP_RETENTION_DAYS} dias)"
}

# =============================================================================
# RESTORE: Restaura backup do banco
# =============================================================================
restore_database() {
    local backup_file="${1:-}"

    if [ -z "$backup_file" ] && [ -f "${BACKUP_DIR}/.latest" ]; then
        backup_file=$(cat "${BACKUP_DIR}/.latest")
    fi

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        error "Nenhum backup encontrado para restaurar."
    fi

    local db_container="kalibrium_mysql"
    local db_name db_user db_pass
    db_name=$(grep -oP '^DB_DATABASE=\K.*' backend/.env | tail -1 | tr -d '\r' || echo "kalibrium")
    db_user=$(grep -oP '^DB_USERNAME=\K.*' backend/.env | tail -1 | tr -d '\r' || echo "kalibrium")
    db_pass=$(grep -oP '^DB_PASSWORD=\K.*' backend/.env | tail -1 | tr -d '\r' || echo "")

    warn "Restaurando banco de: $backup_file"

    if gunzip -c "$backup_file" | docker exec -i -e MYSQL_PWD="$db_pass" "$db_container" mysql -u"$db_user" "$db_name" 2>/dev/null; then
        log "Banco restaurado com sucesso!"
    else
        error "Falha ao restaurar backup. Intervenção manual necessária."
    fi
}

# =============================================================================
# WAIT FOR MYSQL: Polling inteligente
# =============================================================================
wait_for_mysql() {
    local retries=$MYSQL_WAIT_RETRIES
    local interval=$MYSQL_WAIT_INTERVAL
    local attempt=0

    log "Aguardando MySQL ficar pronto..."

    while [ $attempt -lt $retries ]; do
        attempt=$((attempt + 1))

        if docker compose -f "$COMPOSE_FILE" exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
            log "MySQL pronto! (tentativa $attempt/$retries)"
            return 0
        fi

        info "MySQL ainda iniciando... ($attempt/$retries)"
        sleep "$interval"
    done

    error "MySQL não respondeu após $((retries * interval)) segundos. Verifique os logs: docker logs kalibrium_mysql"
}

# =============================================================================
# HEALTH CHECK: Verifica se a API está respondendo
# =============================================================================
health_check() {
    step "ETAPA 6/6: Verificação de saúde"

    local retries=$HEALTH_CHECK_RETRIES
    local interval=$HEALTH_CHECK_INTERVAL
    local attempt=0

    log "Verificando se o sistema está respondendo..."

    while [ $attempt -lt $retries ]; do
        attempt=$((attempt + 1))

        # Verifica API (/up) e Frontend (/) separadamente
        local api_code frontend_code
        api_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/up" 2>/dev/null || echo "000")
        frontend_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/" 2>/dev/null || echo "000")

        if [ "$api_code" = "200" ] && [ "$frontend_code" = "200" ]; then
            log "Sistema saudável! (API: $api_code, Frontend: $frontend_code)"

            docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
                docker compose -f "$COMPOSE_FILE" ps

            echo ""
            log "Deploy concluído com SUCESSO!"
            return 0
        fi

        # Aceita se pelo menos o frontend responde (API pode demorar mais)
        if [ "$frontend_code" = "200" ] && [ $attempt -ge $((retries / 2)) ]; then
            warn "Frontend OK ($frontend_code), mas API retornou $api_code"
            warn "Isso pode ser normal se APP_KEY ou banco não estão 100% configurados."

            docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
                docker compose -f "$COMPOSE_FILE" ps

            echo ""
            log "Deploy concluído (Frontend OK, verifique a API se necessário)."
            return 0
        fi

        info "Aguardando... (API: $api_code, Frontend: $frontend_code, $attempt/$retries)"
        sleep "$interval"
    done

    warn "Sistema não respondeu após $((retries * interval)) segundos."
    return 1
}

# =============================================================================
# BUILD: Constrói imagens sem parar containers atuais
# =============================================================================
build_images() {
    step "ETAPA 4/6: Build das imagens Docker"

    log "Construindo novas imagens (sistema continua no ar)..."

    if ! docker compose -f "$COMPOSE_FILE" build; then
        error "Build falhou! Sistema continua rodando a versão anterior. Corrija os erros e tente novamente."
    fi

    log "Build concluído com sucesso!"

    # Tag para rollback
    for svc in backend frontend; do
        local img
        img=$(docker compose -f "$COMPOSE_FILE" images "$svc" --format "{{.Repository}}" 2>/dev/null | head -1)
        if [ -n "$img" ] && docker image inspect "$img" >/dev/null 2>&1; then
            docker tag "$img" "${img}:rollback-${DEPLOY_TAG}" 2>/dev/null || true
        fi
    done
}

# =============================================================================
# SWAP: Troca para novos containers
# =============================================================================
swap_containers() {
    step "ETAPA 5/6: Atualizando containers"

    log "Parando containers antigos..."
    docker compose -f "$COMPOSE_FILE" down --timeout 30

    if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "your-domain.com" ] && [ -f "nginx/default.conf" ]; then
        sed -i "s|\${DOMAIN}|${DOMAIN}|g" nginx/default.conf
    fi

    log "Iniciando novos containers..."
    docker compose -f "$COMPOSE_FILE" up -d

    wait_for_mysql
}

# =============================================================================
# MIGRATIONS: Executa apenas migrate --force (NUNCA fresh/reset)
# =============================================================================
run_migrations() {
    log "Executando migrations (apenas migrate --force, nunca fresh/reset)..."

    if ! docker compose -f "$COMPOSE_FILE" exec -T backend php artisan migrate --force 2>&1; then
        warn "MIGRATIONS FALHARAM! Restaurando backup do banco..."
        restore_database
        error "Migrations falharam e o banco foi restaurado ao estado anterior. Corrija as migrations e tente novamente."
    fi

    log "Migrations executadas com sucesso!"

    log "Executando seeders de permissões..."
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan db:seed --class=PermissionsSeeder --force 2>&1 || \
        warn "Seeder de permissões falhou (pode ser ignorado se já executado antes)"
}

# =============================================================================
# POST-DEPLOY: Cache e otimizações
# =============================================================================
post_deploy() {
    # APP_KEY
    if ! docker compose -f "$COMPOSE_FILE" exec -T backend grep -q "APP_KEY=base64:" .env 2>/dev/null; then
        log "Gerando APP_KEY..."
        docker compose -f "$COMPOSE_FILE" exec -T backend php artisan key:generate --force
    fi

    log "Otimizando caches..."
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan config:cache 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan route:cache 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan view:cache 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan event:cache 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan storage:link 2>/dev/null || true

    log "Reiniciando queue workers..."
    docker compose -f "$COMPOSE_FILE" restart queue 2>/dev/null || true
}

# =============================================================================
# DEPLOY: Fluxo principal
# =============================================================================
deploy() {
    local do_migrate=false

    if [ "${1:-}" = "--migrate" ]; then
        do_migrate=true
    fi

    preflight
    git_pull

    if [ "$do_migrate" = true ]; then
        backup_database
    fi

    build_images
    swap_containers

    if [ "$do_migrate" = true ]; then
        run_migrations
    fi

    post_deploy

    if ! health_check; then
        warn "Health check falhou. Iniciando rollback automático..."
        rollback_full
        error "Deploy revertido por falha no health check."
    fi
}

# =============================================================================
# ROLLBACK: Rollback completo (código + banco)
# =============================================================================
rollback_full() {
    step "ROLLBACK: Revertendo deploy"

    # Restaura imagens Docker
    for svc in backend frontend; do
        local img
        img=$(docker compose -f "$COMPOSE_FILE" images "$svc" --format "{{.Repository}}" 2>/dev/null | head -1)
        if [ -n "$img" ]; then
            local rollback_tag
            rollback_tag=$(docker images --format '{{.Tag}}' "$img" 2>/dev/null | grep '^rollback-' | sort -r | head -1)
            if [ -n "$rollback_tag" ]; then
                docker tag "${img}:${rollback_tag}" "${img}:latest" 2>/dev/null || true
                log "Restaurado $svc de $rollback_tag"
            fi
        fi
    done

    # Restaura banco se houver backup
    if [ -f "${BACKUP_DIR}/.latest" ]; then
        warn "Restaurando banco do último backup..."
        restore_database
    fi

    # Reinicia containers
    docker compose -f "$COMPOSE_FILE" down --timeout 10 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d

    wait_for_mysql

    post_deploy

    if health_check; then
        log "Rollback concluído com sucesso!"
    else
        error "Rollback falhou. Intervenção manual necessária. Verifique: docker compose -f $COMPOSE_FILE logs"
    fi
}

# =============================================================================
# SEED: Apenas seeders
# =============================================================================
seed_only() {
    preflight
    log "Executando seeders..."
    docker compose -f "$COMPOSE_FILE" exec -T backend php artisan db:seed --class=PermissionsSeeder --force
    log "Seeders concluídos!"
}

# =============================================================================
# BACKUP MANUAL
# =============================================================================
manual_backup() {
    preflight
    backup_database
}

# =============================================================================
# STATUS
# =============================================================================
show_status() {
    echo ""
    info "=== Status dos Containers ==="
    docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
        docker compose -f "$COMPOSE_FILE" ps
    echo ""

    info "=== Espaço em Disco ==="
    df -h / | awk 'NR==2{printf "  Usado: %s / Total: %s (Livre: %s)\n", $3, $2, $4}'
    echo ""

    info "=== Backups ==="
    if [ -d "$BACKUP_DIR" ]; then
        local count
        count=$(find "$BACKUP_DIR" -name "kalibrium_*.sql.gz" 2>/dev/null | wc -l)
        echo "  Backups disponíveis: $count"
        find "$BACKUP_DIR" -name "kalibrium_*.sql.gz" -printf "  %t  %f (%s bytes)\n" 2>/dev/null | tail -5
    else
        echo "  Nenhum backup encontrado"
    fi
    echo ""

    info "=== Git ==="
    if [ -d ".git" ]; then
        echo "  Branch: $(git branch --show-current 2>/dev/null || echo 'N/A')"
        echo "  Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
        echo "  Data:   $(git log -1 --format='%ci' 2>/dev/null || echo 'N/A')"
    else
        echo "  Git não configurado"
    fi
}

# =============================================================================
# LOGS
# =============================================================================
show_logs() {
    docker compose -f "$COMPOSE_FILE" logs --tail=100 "${2:-backend}"
}

# =============================================================================
# SSL INIT
# =============================================================================
init_ssl() {
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "your-domain.com" ]; then
        error "Defina DOMAIN primeiro: DOMAIN=meudominio.com ./deploy.sh --init-ssl"
    fi

    log "Configurando SSL para $DOMAIN..."

    mkdir -p certbot/conf certbot/www

    if [ -f "nginx/default.conf" ]; then
        sed -i "s|\${DOMAIN}|${DOMAIN}|g" nginx/default.conf
    fi

    log "Iniciando servidor HTTP temporário..."
    docker compose -f docker-compose.prod.yml up -d nginx

    log "Solicitando certificado..."
    docker compose -f docker-compose.prod.yml run --rm certbot \
        certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    log "Reiniciando com SSL..."
    docker compose -f docker-compose.prod.yml restart nginx

    log "SSL configurado para $DOMAIN!"
}

# =============================================================================
# MAIN
# =============================================================================
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Kalibrium ERP - Deploy Profissional   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

case "${1:-}" in
    --rollback)  preflight; rollback_full ;;
    --init-ssl)  preflight; init_ssl ;;
    --seed)      seed_only ;;
    --status)    show_status ;;
    --logs)      show_logs "$@" ;;
    --backup)    manual_backup ;;
    *)           deploy "$@" ;;
esac
