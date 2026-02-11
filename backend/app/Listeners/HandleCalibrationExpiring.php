<?php

namespace App\Listeners;

use App\Events\CalibrationExpiring;
use App\Models\CrmActivity;
use App\Models\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleCalibrationExpiring implements ShouldQueue
{
    public function handle(CalibrationExpiring $event): void
    {
        $cal = $event->calibration;
        $days = $event->daysUntilExpiry;
        $equipment = $cal->equipment;
        $customer = $equipment?->customer;

        if (!$customer) {
            return;
        }

        // Notificação interna
        Notification::create([
            'tenant_id' => $cal->tenant_id ?? $equipment->tenant_id,
            'user_id' => $customer->assigned_seller_id,
            'type' => 'calibration_expiring',
            'title' => 'Calibração Vencendo',
            'message' => "A calibração do equipamento {$equipment->serial_number} do cliente {$customer->name} vence em {$days} dias.",
            'data' => [
                'equipment_id' => $equipment->id,
                'customer_id' => $customer->id,
                'days_until_expiry' => $days,
            ],
        ]);

        // Agendar follow-up CRM
        CrmActivity::create([
            'tenant_id' => $equipment->tenant_id,
            'customer_id' => $customer->id,
            'user_id' => $customer->assigned_seller_id,
            'type' => 'follow_up',
            'title' => "Recalibração — {$equipment->serial_number}",
            'description' => "Calibração vence em {$days} dias. Contatar cliente para agendar recalibração.",
            'scheduled_at' => now()->addDays(1),
        ]);
    }
}
