# Segurança em Produção

Checklist e boas práticas para manter o ambiente de produção seguro e profissional.

## Checklist obrigatório (backend/.env no servidor)

| Variável | Valor obrigatório | Motivo |
|----------|-------------------|--------|
| `APP_ENV` | `production` | Desativa debug e otimiza Laravel |
| `APP_DEBUG` | `false` | Evita vazamento de stack traces e dados |
| `APP_KEY` | `base64:...` (gerado) | Criptografia de sessão e cookies; o deploy gera se estiver vazio |
| `CORS_ALLOWED_ORIGINS` | URL real (ex: `http://178.156.176.145`) | Não deixar placeholder; deploy bloqueia se for `https://seu-dominio.com.br` |
| `DB_PASSWORD` | Senha forte | Nunca usar senha de exemplo |
| `SESSION_ENCRYPT` | `true` | Sessões criptografadas |
| `LOG_LEVEL` | `warning` ou `error` | Evitar log excessivo em produção |

## O que o deploy já valida

- **Pre-flight** do `deploy.sh`:
  - Exige `APP_ENV=production`
  - Exige `APP_DEBUG=false`
  - Exige `CORS_ALLOWED_ORIGINS` sem placeholder
  - Backup do banco usa variável de ambiente para senha (não aparece em argumentos)
  - Nome do arquivo de backup sanitizado (apenas números e underscore)

## Comandos proibidos em produção

Nunca executar no servidor:

- `php artisan migrate:fresh` — apaga todos os dados
- `php artisan migrate:reset` — apaga todas as tabelas
- `php artisan db:seed` (sem --class) — pode recriar dados de teste
- Editar `.env` sem backup prévio

O script de deploy usa apenas:

- `php artisan migrate --force`
- `php artisan db:seed --class=PermissionsSeeder --force`

## Nginx (headers de segurança)

O `nginx/default-http.conf` já inclui:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restritiva
- `server_tokens off`

Com domínio e HTTPS (`nginx/default.conf`), são aplicados também HSTS e CSP.

## Ajuste do .env atual no servidor

Se o deploy bloquear com "APP_ENV deve ser production" ou "APP_DEBUG deve ser false":

1. Conectar por SSH: `ssh -i ~/.ssh/id_ed25519 root@178.156.176.145`
2. Ajustar em uma linha (no servidor):
   ```bash
   cd /root/sistema && sed -i 's/^APP_ENV=.*/APP_ENV=production/' backend/.env && sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' backend/.env
   ```
   Ou editar manualmente: `nano /root/sistema/backend/.env` e definir `APP_ENV=production` e `APP_DEBUG=false`.
3. Rodar o deploy novamente.

## Backups

- Diretório: `/root/backups`
- Retenção: 7 dias (rotação automática)
- Formato: `kalibrium_YYYYMMDD_HHMMSS.sql.gz`
- O backup é feito **antes** de rodar migrations; em caso de falha, o banco é restaurado.

## Contato e acesso

- Servidor: 178.156.176.145 (Hetzner)
- Acesso: somente SSH com chave; não usar senha root.
- Manter sistema e dependências atualizados (pacotes, imagens Docker) conforme política de manutenção.
