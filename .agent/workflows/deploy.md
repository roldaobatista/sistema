---
description: Deploy para produção. Usar quando o usuário pedir para publicar, subir, ou atualizar o sistema em produção.
---

# /deploy - Deploy para Produção

## Comando Rápido

```powershell
# Do Cursor terminal (working_directory: C:\projetos\sistema)
.\deploy-prod.ps1 -Migrate    # Com migrations (novas tabelas/colunas)
.\deploy-prod.ps1              # Sem migrations (apenas código)
```

## Fluxo Completo

1. Verificar mudanças não commitadas → commitar se necessário
2. `.\deploy-prod.ps1 -Migrate` (ou sem -Migrate se não há migrations novas)
3. O script cuida de tudo: push, SSH, backup, build, migrate, health check

## Sub-comandos

| Comando | Quando usar |
|---------|-------------|
| `.\deploy-prod.ps1` | Apenas código alterado |
| `.\deploy-prod.ps1 -Migrate` | Novas migrations/tabelas/colunas |
| `.\deploy-prod.ps1 -Seed` | Novas permissões adicionadas |
| `.\deploy-prod.ps1 -Rollback` | Reverter deploy com problema |
| `.\deploy-prod.ps1 -Status` | Ver status dos containers |
| `.\deploy-prod.ps1 -Logs` | Ver logs do backend |
| `.\deploy-prod.ps1 -Backup` | Backup manual do banco |

## Servidor

- IP: 178.156.176.145
- SSH: `ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@178.156.176.145`
- URL: http://178.156.176.145
- Backups: /root/backups (7 dias)

## Proteções Automáticas

- Backup do banco antes de migrations
- Build sem parar o sistema
- Health check pós-deploy
- Rollback automático se falhar
- Bloqueia deploy com código não commitado
