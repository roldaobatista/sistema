#!/bin/bash
set -euo pipefail

# =============================================================================
# Kalibrium ERP - Deploy Script
# =============================================================================
# Usage:
#   ./deploy.sh              # Full deploy
#   ./deploy.sh --migrate    # Deploy with migrations + seeders
#   ./deploy.sh --seed       # Run seeders only (permissions, etc)
#   ./deploy.sh --rollback   # Rollback to previous version
#   ./deploy.sh --init-ssl   # Initial SSL certificate setup
# =============================================================================

COMPOSE_FILE="docker-compose.prod.yml"
DOMAIN="${DOMAIN:-your-domain.com}"
EMAIL="${CERTBOT_EMAIL:-admin@your-domain.com}"
DEPLOY_TAG="${DEPLOY_TAG:-$(date +%Y%m%d_%H%M%S)}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Pre-flight checks
preflight() {
    log "Running pre-flight checks..."

    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker compose >/dev/null 2>&1 || error "Docker Compose is not installed"

    [ -f "$COMPOSE_FILE" ] || error "$COMPOSE_FILE not found"
    [ -f "backend/.env" ] || error "backend/.env not found. Copy from .env.example and configure."

    if [ "$DOMAIN" = "your-domain.com" ]; then
        warn "DOMAIN not set! Use: DOMAIN=meudominio.com ./deploy.sh"
        warn "Continuing with default domain..."
    fi

    # Validate CORS configuration
    if grep -q 'CORS_ALLOWED_ORIGINS=https://seu-dominio.com.br' backend/.env 2>/dev/null; then
        error "CORS_ALLOWED_ORIGINS still has placeholder value in backend/.env! Set it to your actual frontend domain (e.g., https://$DOMAIN). Without this, the frontend cannot communicate with the API."
    fi

    log "Pre-flight checks passed!"
}

# Replace domain in nginx config
configure_nginx() {
    log "Configuring nginx for domain: $DOMAIN"

    if [ -f "nginx/default.conf" ]; then
        sed -i "s|\${DOMAIN}|${DOMAIN}|g" nginx/default.conf
    fi
}

# Build and start all services
deploy() {
    log "Building images (tag: $DEPLOY_TAG)..."
    docker compose -f "$COMPOSE_FILE" build --no-cache

    # Tag current images for rollback
    log "Tagging current images for rollback..."
    for svc in backend frontend; do
        local img="kalibrium_${svc}"
        if docker image inspect "$img" >/dev/null 2>&1; then
            docker tag "$img" "${img}:rollback-${DEPLOY_TAG}" 2>/dev/null || true
        fi
    done

    log "Stopping current services..."
    docker compose -f "$COMPOSE_FILE" down

    # Configure nginx domain
    configure_nginx

    log "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d

    log "Waiting for database..."
    sleep 15

    if [ "${1:-}" = "--migrate" ]; then
        log "Running migrations..."
        docker compose -f "$COMPOSE_FILE" exec backend php artisan migrate --force

        log "Running seeders (permissions, roles)..."
        docker compose -f "$COMPOSE_FILE" exec backend php artisan db:seed --class=PermissionsSeeder --force
    fi

    # Generate APP_KEY if not set
    if ! docker compose -f "$COMPOSE_FILE" exec backend grep -q "APP_KEY=base64:" .env 2>/dev/null; then
        log "Generating APP_KEY..."
        docker compose -f "$COMPOSE_FILE" exec backend php artisan key:generate --force
    fi

    log "Caching configuration..."
    docker compose -f "$COMPOSE_FILE" exec backend php artisan config:cache
    docker compose -f "$COMPOSE_FILE" exec backend php artisan route:cache
    docker compose -f "$COMPOSE_FILE" exec backend php artisan view:cache
    docker compose -f "$COMPOSE_FILE" exec backend php artisan event:cache

    log "Linking storage..."
    docker compose -f "$COMPOSE_FILE" exec backend php artisan storage:link || true

    log "Restarting queue workers..."
    docker compose -f "$COMPOSE_FILE" restart queue

    log "Checking health..."
    sleep 5
    if docker compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy"; then
        warn "Some services are unhealthy. Check with: docker compose -f $COMPOSE_FILE ps"
    else
        log "All services healthy!"
    fi

    log "Deploy complete!"
    docker compose -f "$COMPOSE_FILE" ps
}

# Seed only (permissions, roles)
seed_only() {
    log "Running seeders..."
    docker compose -f "$COMPOSE_FILE" exec backend php artisan db:seed --class=PermissionsSeeder --force
    log "Seeders completed!"
}

# Rollback
rollback() {
    local tag="${2:-}"
    if [ -z "$tag" ]; then
        warn "Looking for latest rollback tag..."
        tag=$(docker images --format '{{.Tag}}' kalibrium_backend 2>/dev/null | grep '^rollback-' | sort -r | head -1)
        if [ -z "$tag" ]; then
            error "No rollback tags found. Cannot rollback."
        fi
        log "Using rollback tag: $tag"
    fi

    warn "Rolling back to tag: $tag..."
    docker compose -f "$COMPOSE_FILE" down

    for svc in backend frontend; do
        local img="kalibrium_${svc}"
        if docker image inspect "${img}:${tag}" >/dev/null 2>&1; then
            docker tag "${img}:${tag}" "$img:latest" 2>/dev/null || true
            log "Restored ${svc} from ${tag}"
        fi
    done

    docker compose -f "$COMPOSE_FILE" up -d

    log "Rollback complete. Database migrations are NOT rolled back automatically."
    warn "To rollback migrations: docker compose -f $COMPOSE_FILE exec backend php artisan migrate:rollback"
}

# Initial SSL setup
init_ssl() {
    log "Setting up SSL certificates for $DOMAIN..."

    if [ "$DOMAIN" = "your-domain.com" ]; then
        error "Please set DOMAIN first: DOMAIN=meudominio.com ./deploy.sh --init-ssl"
    fi

    mkdir -p certbot/conf certbot/www

    # Configure nginx before starting
    configure_nginx

    log "Starting temporary HTTP server..."
    docker compose -f "$COMPOSE_FILE" up -d nginx

    log "Requesting certificate..."
    docker compose -f "$COMPOSE_FILE" run --rm certbot \
        certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    log "Restarting nginx with SSL..."
    docker compose -f "$COMPOSE_FILE" restart nginx

    log "SSL setup complete for $DOMAIN!"
}

# Main
case "${1:-}" in
    --rollback)
        preflight
        rollback
        ;;
    --init-ssl)
        preflight
        init_ssl
        ;;
    --seed)
        preflight
        seed_only
        ;;
    *)
        preflight
        deploy "$@"
        ;;
esac
