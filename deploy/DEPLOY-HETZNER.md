# Deploy no Hetzner — Kalibrium ERP

Servidor: **178.156.176.145** | Domínio: **app.balancassolution.com**

---

## ⚠️ REGRA CRÍTICA: HTTP vs HTTPS

> **NUNCA use `docker-compose.prod-http.yml` se o domínio já tem SSL configurado.**
> O script `deploy.sh` auto-detecta o compose correto. **SEMPRE use `deploy.sh`.**

| Situação | Compose File | Como saber |
|---|---|---|
| Primeiro deploy (sem domínio) | `docker-compose.prod-http.yml` | `certbot/conf/live/` vazio |
| **Produção com domínio (atual)** | **`docker-compose.prod-https.yml`** | `certbot/conf/live/app.balancassolution.com/` existe |

**Se usar o compose errado (HTTP quando tem SSL):**

- Frontend não consegue chamar a API → `ERR_CONNECTION_REFUSED`
- Login falha completamente
- Porta 443 fica fechada

---

## Deploy Rápido (Recomendado)

### Do seu PC (Windows)

```powershell
# Deploy padrão (sem migrations)
.\deploy-prod.ps1

# Deploy com migrations (faz backup automático)
.\deploy-prod.ps1 -Migrate

# Ver status
.\deploy-prod.ps1 -Status
```

### Direto no servidor (SSH)

```bash
cd /root/sistema
./deploy.sh              # Deploy padrão
./deploy.sh --migrate    # Com migrations
./deploy.sh --status     # Status
./deploy.sh --rollback   # Rollback emergencial
```

---

## Setup Inicial (Primeira Vez)

### 1. Enviar projeto

```powershell
scp -i $env:USERPROFILE\.ssh\id_ed25519 -r C:\projetos\sistema root@178.156.176.145:/root/sistema
```

### 2. Configurar `.env`

```bash
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@178.156.176.145
cd /root/sistema
cp backend/.env.example backend/.env
nano backend/.env
```

Ajustar:

- `APP_URL=https://app.balancassolution.com`
- `CORS_ALLOWED_ORIGINS=https://app.balancassolution.com`
- `DB_ROOT_PASSWORD=` → senha forte
- `DB_PASSWORD=` → senha forte

Criar `.env` na raiz:

```bash
cat > .env << 'EOF'
DOMAIN=app.balancassolution.com
REVERB_APP_KEY=kalibrium-key
DB_ROOT_PASSWORD=sua_senha
DB_PASSWORD=sua_senha
DB_USERNAME=kalibrium
EOF
```

### 3. Configurar SSL (se primeiro deploy com domínio)

```bash
DOMAIN=app.balancassolution.com CERTBOT_EMAIL=admin@balancassolution.com ./deploy.sh --init-ssl
```

### 4. Deploy

```bash
./deploy.sh --migrate
```

---

## Deploy Manual (EMERGÊNCIA APENAS)

> ⚠️ Prefira SEMPRE `deploy.sh` ou `deploy-prod.ps1`. Deploy manual é para emergências.

```bash
cd /root/sistema

# VERIFICAR qual compose usar !!!
if [ -d "certbot/conf/live" ] && [ "$(ls -A certbot/conf/live 2>/dev/null)" ]; then
    COMPOSE="docker-compose.prod-https.yml"
else
    COMPOSE="docker-compose.prod-http.yml"
fi
echo "Usando: $COMPOSE"

# Build e deploy
docker compose -f $COMPOSE build --no-cache frontend
docker compose -f $COMPOSE down
docker compose -f $COMPOSE up -d

# Migrations (se necessário)
docker compose -f $COMPOSE exec backend php artisan migrate --force
docker compose -f $COMPOSE exec backend php artisan config:cache
```

---

## Troubleshooting

### ERR_CONNECTION_REFUSED no login

**Causa:** Servidor rodando compose HTTP, mas acessando via HTTPS.
**Solução:**

```bash
docker compose -f docker-compose.prod-http.yml down
docker compose -f docker-compose.prod-https.yml build --no-cache frontend
docker compose -f docker-compose.prod-https.yml up -d
```

### 500 Internal Server Error em endpoints

**Causa:** Código referencia colunas inexistentes no banco.
**Solução:** Verificar logs: `docker exec kalibrium_backend tail -100 /var/www/storage/logs/laravel.log`

### Certificado SSL expirado

```bash
docker compose -f docker-compose.prod-https.yml run --rm certbot certbot renew
docker compose -f docker-compose.prod-https.yml restart nginx
```
