# Checklist de migrations (estoque, garantia, central, qualidade)

## Já executadas (Batch 6)
- `2026_02_17_100000_add_warehouse_technician_and_vehicle_support` — warehouses: user_id, vehicle_id, type varchar(20)
- `2026_02_17_100001_add_stock_transfer_acceptance_and_used_items` — stock_transfers (aceite), used_stock_items, returned_used_item_dispositions
- `2026_02_17_100002_create_warranty_tracking_table` — warranty_tracking

## Executadas nesta sessão
- `2026_02_17_110000_add_remind_notified_at_to_central_items` — OK
- `2026_02_17_120000_quality_management_review_and_complaint_dates` — OK (corrigido: índice com argumentos na ordem correta `index([colunas], 'nome')`)

## Regras conferidas
- Sem `->after()`
- Sem `->default()` em JSON
- Índices com nome curto onde necessário
- Guards hasTable/hasColumn
- Colunas novas nullable ou com default

## Comandos (para produção ou outro ambiente)
```bash
cd backend
php artisan migrate --force
php artisan db:seed --class=PermissionsSeeder --force
```
