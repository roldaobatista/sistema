# Troubleshooting: API e WebSocket em produção

## Caso 1: Requisições para https://178.156.176.145 falham (ERR_CONNECTION_REFUSED)

### Sintoma

O console mostra `net::ERR_CONNECTION_REFUSED` em requisições para **https://178.156.176.145/api/v1/...** (notifications/unread-count, dashboard-stats, etc.).

### Causa

O servidor de produção está em **HTTP only** (porta 80). SSL **não** está configurado. Se o frontend foi buildado com `VITE_API_URL=https://178.156.176.145/api/v1`, o navegador tenta conexão **HTTPS** (porta 443); como nada escuta em 443, a conexão é recusada.

### Solução

No servidor, no arquivo **`.env` da raiz** (`/root/sistema/.env`), use **HTTP** na URL da API:

```env
# Correto para produção HTTP-only (178.156.176.145)
VITE_API_URL=http://178.156.176.145/api/v1
```

Ou, se o usuário **sempre** acessar o sistema por **http://178.156.176.145**, deixe vazio para usar mesma origem:

```env
VITE_API_URL=
```

Depois: **rebuild do frontend** e **restart** (ou redeploy):

```bash
cd /root/sistema
docker compose -f docker-compose.prod-http.yml build frontend
docker compose -f docker-compose.prod-http.yml up -d
docker compose -f docker-compose.prod-http.yml restart nginx
```

E acesse o sistema por **http://178.156.176.145** (não use https no navegador para esse IP).

---

## Caso 2: app.balancassolution.com (API e WebSocket)

### Sintoma

No console do navegador em **https://app.balancassolution.com** aparecem:

- `Failed to load resource: net::ERR_CONNECTION_REFUSED` para `/api/v1/notifications/unread-count`, `/api/v1/dashboard-stats`, etc.
- `WebSocket connection to 'wss://app.balancassolution.com/app' failed`

Ou seja: o frontend não consegue falar com a API nem com o Reverb (WebSocket).

### Causa

**ERR_CONNECTION_REFUSED** significa que nada está aceitando a conexão naquele endereço/porta. Em geral:

1. **O domínio não aponta para o servidor que tem o backend**  
   Ex.: `app.balancassolution.com` aponta para um host que só serve o frontend (ex.: CDN/static) e não tem proxy para `/api` e `/app`.

2. **Há um proxy HTTPS na frente que não repassa `/api` e `/app`**  
   Ex.: Cloudflare ou outro nginx com SSL que só encaminha para o container do frontend; as requisições para `/api` e `/app` não chegam ao nginx que faz o proxy para backend e Reverb.

## Servidor de produção (referência)

- **IP:** 178.156.176.145  
- **Stack:** Docker Compose (`docker-compose.prod-http.yml`)  
- **Nginx:** escuta na porta 80 e faz:
  - `/api` → backend (Laravel)
  - `/app` → reverb:8080 (WebSocket)
  - `/` → frontend (SPA)

Ou seja: em **http://178.156.176.145** tudo funciona porque o mesmo nginx atende API, WebSocket e frontend.

## O que verificar

### 1. DNS

- Para onde o **A (ou CNAME)** de `app.balancassolution.com` aponta?
- Se for para **outro IP** que não 178.156.176.145, esse outro host precisa ter a stack completa (nginx com proxy para `/api` e `/app`) ou ser um proxy reverso que encaminha tudo para 178.156.176.145.

### 2. Uso de HTTPS (app.balancassolution.com)

Se você acessa por **https://**, alguém está terminando SSL (ex.: Cloudflare, nginx com certificado). Esse proxy precisa:

- Receber **todo** o tráfego de `app.balancassolution.com` (incluindo `/api` e `/app`).
- Encaminhar para o **mesmo** nginx em 178.156.176.145 (porta 80), para que esse nginx continue fazendo:
  - `location /api` → backend
  - `location /app` → reverb
  - `location /` → frontend

Se o proxy HTTPS encaminhar só para o container do frontend ou só para uma porta que não tem esse mapeamento, você verá **ERR_CONNECTION_REFUSED** (ou 404) em `/api` e falha no WebSocket em `/app`.

### 3. Build do frontend (variáveis de ambiente)

No servidor, o build do frontend usa o `.env` da raiz do projeto. Para **mesma origem** (recomendado quando o front e a API estão no mesmo domínio):

- **VITE_API_URL** vazio (ou não definido) → o front usa `/api/v1` relativo (mesmo domínio).
- **VITE_REVERB_***: se vazios, o Echo usa o host/porta/scheme da própria página (mesmo domínio).

Assim, em **https://app.balancassolution.com** o frontend chama `https://app.balancassolution.com/api/v1/...` e `wss://app.balancassolution.com/app`. Quem atende esse domínio **tem** de ser o nginx que faz proxy para backend e Reverb (ou um proxy reverso que encaminha tudo para esse nginx).

## Checklist rápido

- [ ] DNS de `app.balancassolution.com` aponta para o IP que tem a stack (178.156.176.145 ou outro com nginx correto).
- [ ] Se houver proxy HTTPS, ele encaminha **todo** o tráfego (incluindo `/api` e `/app`) para o nginx na porta 80 desse servidor.
- [ ] No servidor, o `.env` da raiz não força outra origem para a API (VITE_API_URL vazio para mesmo domínio).
- [ ] Após alterar proxy ou DNS, fazer um novo deploy e testar em https://app.balancassolution.com (e no console, ver se as chamadas para `/api/v1/...` e `wss://.../app` passam a responder).

## Teste direto no servidor

No servidor (178.156.176.145), para confirmar que API e Reverb estão ok:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/up
# Esperado: 200 ou 204

curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/dashboard-stats
# Esperado: 401 (sem token) ou 200 (com auth) — não deve ser connection refused
```

Se isso funcionar em **http://178.156.176.145** mas falhar em **https://app.balancassolution.com**, o problema está no proxy/DNS do domínio HTTPS.
