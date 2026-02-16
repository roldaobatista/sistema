<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Console\Command;

class InventoryWeeklyReminder extends Command
{
    protected $signature = 'inventory:weekly-reminder';
    protected $description = 'Envia lembrete semanal para técnicos e motoristas realizarem inventário do estoque (PWA)';

    public function handle(): int
    {
        $tenants = Tenant::where('status', Tenant::STATUS_ACTIVE)->get();
        $count = 0;

        foreach ($tenants as $tenant) {
            $technicianWarehouses = Warehouse::where('tenant_id', $tenant->id)
                ->where('type', Warehouse::TYPE_TECHNICIAN)
                ->whereNotNull('user_id')
                ->pluck('user_id')->unique()->filter();

            $vehicleWarehouses = Warehouse::where('tenant_id', $tenant->id)
                ->where('type', Warehouse::TYPE_VEHICLE)
                ->whereNotNull('vehicle_id')
                ->with('vehicle:id,assigned_user_id')
                ->get()
                ->pluck('vehicle.assigned_user_id')
                ->unique()
                ->filter();

            $userIds = $technicianWarehouses->merge($vehicleWarehouses)->unique()->filter();

            foreach ($userIds as $userId) {
                $user = User::find($userId);
                if (!$user || !$user->is_active) {
                    continue;
                }
                Notification::notify(
                    $tenant->id,
                    $user->id,
                    'inventory_weekly_reminder',
                    'Lembrete: realize a contagem do seu estoque esta semana',
                    [
                        'message' => 'Acesse o app e faça o inventário do seu estoque em Estoque > Meu inventário.',
                        'icon' => 'clipboard-check',
                        'link' => '/estoque/inventario-pwa',
                        'data' => ['reminder' => 'weekly'],
                    ]
                );
                $count++;
            }
        }

        $this->info("Lembretes de inventário semanal enviados: {$count}.");
        return self::SUCCESS;
    }
}
