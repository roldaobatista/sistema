<?php

namespace App\Console\Commands;

use App\Models\Equipment;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class GenerateCalibrationAlerts extends Command
{
    protected $signature = 'calibration:alerts {--days=30 : Dias para frente}';
    protected $description = 'Gera notificações para calibrações vencendo ou vencidas';

    public function handle(): int
    {
        $days = (int) $this->option('days');

        $equipments = Equipment::with('customer:id,name')
            ->calibrationDue($days)
            ->active()
            ->get();

        $created = 0;

        foreach ($equipments as $eq) {
            $daysRemaining = (int) now()->diffInDays($eq->next_calibration_at, false);

            // Evitar duplicatas: não criar se já existe notificação do mesmo tipo nos últimos 7 dias
            $exists = Notification::where('notifiable_type', Equipment::class)
                ->where('notifiable_id', $eq->id)
                ->where('type', $daysRemaining < 0 ? 'calibration_overdue' : 'calibration_due')
                ->where('created_at', '>=', now()->subDays(7))
                ->exists();

            if ($exists) continue;

            // Notificar admins e gerentes do tenant
            $users = User::where('tenant_id', $eq->tenant_id)
                ->where('is_active', true)
                ->whereHas('roles', fn($q) => $q->whereIn('name', ['super_admin', 'admin', 'gerente']))
                ->get();

            foreach ($users as $user) {
                Notification::calibrationDue($eq, $user->id, $daysRemaining);
                $created++;
            }
        }

        $this->info("✅ {$created} notificações criadas para {$equipments->count()} equipamentos.");

        return Command::SUCCESS;
    }
}
