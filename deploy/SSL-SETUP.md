# Ativar HTTPS (navegador "Seguro")

O aviso **"Não seguro"** aparece porque o site está em **HTTP**. Para o navegador mostrar **"Seguro"** (cadeado), é preciso servir o site em **HTTPS** com certificado válido.

O Let's Encrypt **não emite certificado para IP** — só para **domínio**. Por isso é obrigatório ter um domínio (ex: `gestao.empresa.com`) apontando para o servidor.

## Pré-requisitos

1. **Domínio** (ex: `gestao.kalibrium.com` ou `sistema.empresa.com`)
2. **Registro DNS**: tipo **A** do domínio apontando para **178.156.176.145**
3. **Porta 80** acessível da internet (para o Let's Encrypt validar)

## Passos no servidor

### 1. Conferir DNS

No seu PC:

```bash
nslookup gestao.empresa.com
```

O endereço deve ser **178.156.176.145**. Se ainda não estiver, espere a propagação do DNS (até alguns minutos).

### 2. Definir variáveis e rodar init-ssl

No servidor (`ssh root@178.156.176.145`):

```bash
cd /root/sistema

# Trocar pelo seu domínio e e-mail (Let's Encrypt envia avisos para esse e-mail)
export DOMAIN=gestao.empresa.com
export CERTBOT_EMAIL=admin@empresa.com

./deploy.sh --init-ssl
```

O script vai:

- Colocar o nginx temporariamente só em HTTP (porta 80)
- Pedir o certificado ao Let's Encrypt
- Ativar a configuração HTTPS e reiniciar o nginx

Se der erro, confira: DNS do domínio aponta para este servidor? Firewall libera porta 80?

### 3. Usar compose com SSL daqui pra frente

Depois do `--init-ssl`, o deploy deve usar sempre o compose com SSL:

```bash
cd /root/sistema
docker compose -f docker-compose.prod.yml up -d
```

(O script `deploy.sh` sem `--init-ssl` já escolhe automaticamente `docker-compose.prod.yml` quando existir certificado em `certbot/conf/live`.)

### 4. Ajustar .env para o domínio

**Raiz do projeto** (`.env` na pasta `/root/sistema`):

```env
DOMAIN=gestao.empresa.com
```

**Backend** (`backend/.env`):

```env
APP_URL=https://gestao.empresa.com
CORS_ALLOWED_ORIGINS=https://gestao.empresa.com
SESSION_DOMAIN=gestao.empresa.com
```

### 5. Rebuild do frontend (API/WebSocket em HTTPS)

O frontend precisa ser construído com as URLs HTTPS. Na raiz do projeto no servidor:

```bash
export DOMAIN=gestao.empresa.com
# Opcional: sobrescrever se precisar
# export VITE_API_URL=https://gestao.empresa.com/api/v1
# export VITE_WS_URL=wss://gestao.empresa.com/app
# export VITE_REVERB_HOST=gestao.empresa.com
# export VITE_REVERB_PORT=443
# export VITE_REVERB_SCHEME=https

docker compose -f docker-compose.prod.yml build frontend --no-cache
docker compose -f docker-compose.prod.yml up -d
```

(O `docker-compose.prod.yml` já usa `VITE_API_URL`, `VITE_WS_URL`, etc. com `https://${DOMAIN}` quando `DOMAIN` está no `.env`.)

### 6. Renovação do certificado

O container **certbot** no `docker-compose.prod.yml` renova o certificado automaticamente (script roda a cada 12h). Não é necessário fazer nada.

## Resumo

| Situação              | Ação                                                                 |
|-----------------------|----------------------------------------------------------------------|
| Ainda só tem IP       | Site continua em HTTP; "Não seguro" só some com domínio + HTTPS.    |
| Já tem domínio        | DNS A → 178.156.176.145; depois `DOMAIN=... CERTBOT_EMAIL=... ./deploy.sh --init-ssl`. |
| Depois do init-ssl    | Usar `docker-compose.prod.yml`, configurar APP_URL/CORS e rebuild do frontend. |

Acesso final: **https://gestao.empresa.com** — o navegador deve mostrar **"Seguro"**.
