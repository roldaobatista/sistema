# Deploy no Hetzner via IP (HTTP)

Servidor já configurado: **178.156.176.145** (Docker, UFW, Git).

## Passos

### 1. Enviar o projeto para o servidor

No seu PC, na pasta do projeto:

```powershell
scp -i $env:USERPROFILE\.ssh\id_ed25519 -r C:\projetos\sistema root@178.156.176.145:/root/sistema
```

Ou se o repositório estiver no Git:

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@178.156.176.145 "cd /root && git clone SEU_REPOSITORIO sistema && cd sistema"
```

### 2. Configurar backend/.env no servidor

No servidor:

```bash
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@178.156.176.145
```

Dentro do servidor:

```bash
cd /root/sistema
cp backend/.env.example backend/.env
nano backend/.env
```

Ajuste pelo menos:

- `APP_KEY=` → rode `php artisan key:generate` depois
- `DB_ROOT_PASSWORD=` → senha forte
- `DB_PASSWORD=` → mesma senha ou outra forte
- `CORS_ALLOWED_ORIGINS=http://178.156.176.145` (para acesso via IP)
- `REVERB_APP_KEY=` → gere com `php artisan reverb:install` ou defina um valor qualquer
- `APP_URL=http://178.156.176.145`

### 3. Deploy via HTTP (IP)

```bash
cd /root/sistema

# Variáveis para o frontend (API e WebSocket via IP)
export VITE_API_URL=http://178.156.176.145/api/v1
export VITE_WS_URL=ws://178.156.176.145/app
export VITE_REVERB_HOST=178.156.176.145
export VITE_REVERB_PORT=80
export VITE_REVERB_SCHEME=http

# Usar o .env do backend para REVERB_APP_KEY e DB_*
# Crie .env na raiz se necessário:
echo "REVERB_APP_KEY=kalibrium-key" >> .env
echo "DB_ROOT_PASSWORD=sua_senha_forte" >> .env
echo "DB_PASSWORD=sua_senha_forte" >> .env
echo "DB_USERNAME=kalibrium" >> .env

# Build e subir
docker compose -f docker-compose.prod-http.yml build --no-cache
docker compose -f docker-compose.prod-http.yml up -d

# Aguardar MySQL
sleep 20

# Migrations e cache
docker compose -f docker-compose.prod-http.yml exec backend php artisan migrate --force
docker compose -f docker-compose.prod-http.yml exec backend php artisan key:generate --force
docker compose -f docker-compose.prod-http.yml exec backend php artisan config:cache
docker compose -f docker-compose.prod-http.yml exec backend php artisan db:seed --class=PermissionsSeeder --force
```

### 4. Acessar

Abra no navegador: **http://178.156.176.145**

---

## Quando tiver domínio

1. Aponte o domínio para `178.156.176.145`
2. Configure `nginx/default.conf` (versão SSL)
3. Use `docker-compose.prod.yml` e `./deploy.sh --init-ssl`
