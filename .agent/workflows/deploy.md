---
description: Deploy para produção no Hetzner. Pre-flight checks, build, deploy e verificação.
---

# /deploy - Deploy Produção (Kalibrium ERP)

## ⚠️ REGRA CRÍTICA

> **NUNCA use `docker-compose.prod-http.yml` manualmente se certificados SSL existem.**
> O `deploy.sh` auto-detecta o compose correto.
> Domínio atual: `app.balancassolution.com` (HTTPS)

---

## Servidor

- **IP:** 178.156.176.145
- **Domínio:** app.balancassolution.com
- **SSH Key:** `$env:USERPROFILE\.ssh\id_ed25519`
- **User:** root
- **Deploy dir:** `/root/sistema`

---

## Sub-comandos

```
/deploy            - Deploy padrão (sem migrations)
/deploy migrate    - Deploy com migrations (backup automático)
/deploy seed       - Apenas seeders
/deploy status     - Status dos containers
/deploy logs       - Últimas 100 linhas de log
/deploy rollback   - Rollback emergencial
/deploy backup     - Backup manual do banco
```

---

## Fluxo do Deploy

### 1. Verificar código limpo (local)

// turbo

```powershell
cd c:\projetos\sistema
git status
```

### 2. Push para GitHub (se necessário)

```powershell
git push origin main
```

### 3. Executar deploy remoto

// turbo

```powershell
.\deploy-prod.ps1
```

Ou com migrations:

```powershell
.\deploy-prod.ps1 -Migrate
```

### 4. Verificar no browser

Acessar: **<https://app.balancassolution.com>**

---

## Deploy Manual (SSH direto — somente emergência)

// turbo-all

### 1. Conectar ao servidor

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@178.156.176.145
```

### 2. No servidor

```bash
cd /root/sistema && ./deploy.sh --migrate
```

---

## Compose Files (IMPORTANTE!)

| Arquivo | Quando usar | Portas |
|---|---|---|
| `docker-compose.prod-http.yml` | Primeiro deploy sem domínio | 80 |
| `docker-compose.prod-https.yml` | **Produção com SSL (ATUAL)** | 80 + 443 |
| `docker-compose.prod.yml` | Referência original | 80 + 443 |
| `docker-compose.yml` | Desenvolvimento local | 3307, 8080 |

> **O `deploy.sh` escolhe automaticamente** verificando `certbot/conf/live/`.
> **NUNCA escolha manualmente** — use `deploy.sh` ou `deploy-prod.ps1`.

---

## Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| `ERR_CONNECTION_REFUSED` | Compose HTTP ativo com domínio HTTPS | `docker compose -f docker-compose.prod-https.yml up -d` |
| 500 no endpoint | Coluna inexistente / bug no código | Verificar log: `docker exec kalibrium_backend tail -100 /var/www/storage/logs/laravel.log` |
| Login 422 | Credenciais inválidas ou usuário não existe | Verificar via `php artisan tinker` |
| Cert expirado | Let's Encrypt não renovou | `docker compose run --rm certbot certbot renew` |
