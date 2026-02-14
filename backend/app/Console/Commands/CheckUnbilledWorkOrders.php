<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckUnbilledWorkOrders extends Command
{
    protected $signature = 'work-orders:check-unbilled {--days=3 : Days after completion without billing to alert}';
    protected $description = 'Alert about completed work orders without billing (CRITICAL business alert)';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $threshold = now()->subDays($days);

        $workOrders = WorkOrder::withoutGlobalScopes()
            ->where('status', WorkOrder::STATUS_COMPLETED)
            ->where('completed_at', '<=', $threshold)
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('invoices')
                    ->whereColumn('invoices.work_order_id', 'work_orders.id');
            })
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('accounts_receivable')
                    ->whereColumn('accounts_receivable.work_order_id', 'work_orders.id');
            })
            ->with(['customer:id,name', 'assignee:id,name'])
            ->get();

        $count = 0;
        foreach ($workOrders as $wo) {
            $daysSinceCompletion = (int) $wo->completed_at->diffInDays(now());
            app()->instance('current_tenant_id', $wo->tenant_id);

            $admins = User::withoutGlobalScopes()
                ->where('tenant_id', $wo->tenant_id)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin', 'financeiro']))
                ->get();

            foreach ($admins as $admin) {
                $existing = Notification::withoutGlobalScopes()
                    ->where('user_id', $admin->id)
                    ->where('notifiable_type', WorkOrder::class)
                    ->where('notifiable_id', $wo->id)
                    ->where('type', 'unbilled_work_order')
                    ->where('created_at', '>=', now()->subDays(1))
                    ->exists();

                if ($existing) {
                    continue;
                }

                $woNumber = $wo->os_number ?? $wo->number;
                Notification::notify(
                    $wo->tenant_id,
                    $admin->id,
                    'unbilled_work_order',
                    '🔴 OS concluída sem faturamento',
                    [
                        'message' => "OS {$woNumber} (cliente: {$wo->customer?->name}) concluída há {$daysSinceCompletion} dia(s) sem faturamento",
                        'notifiable_type' => WorkOrder::class,
                        'notifiable_id' => $wo->id,
                    ]
                );
                $count++;
            }
        }

        $this->info("Sent {$count} unbilled work order alert(s) for {$workOrders->count()} WO(s).");
        return self::SUCCESS;
    }
}
