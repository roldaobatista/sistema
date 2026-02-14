<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\User;
use Illuminate\Console\Command;

class CheckExpiringContracts extends Command
{
    protected $signature = 'contracts:check-expiring {--days=7 : Days before expiry to alert}';
    protected $description = 'Alert about recurring contracts expiring within N days';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $threshold = now()->addDays($days);

        $contracts = RecurringContract::withoutGlobalScopes()
            ->where('is_active', true)
            ->whereNotNull('end_date')
            ->whereBetween('end_date', [now(), $threshold])
            ->with(['customer:id,name'])
            ->get();

        $count = 0;
        foreach ($contracts as $contract) {
            $daysLeft = (int) now()->diffInDays($contract->end_date);
            app()->instance('current_tenant_id', $contract->tenant_id);

            $admins = User::withoutGlobalScopes()
                ->where('tenant_id', $contract->tenant_id)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin', 'financeiro']))
                ->get();

            foreach ($admins as $admin) {
                $existing = Notification::withoutGlobalScopes()
                    ->where('user_id', $admin->id)
                    ->where('notifiable_type', RecurringContract::class)
                    ->where('notifiable_id', $contract->id)
                    ->where('type', 'contract_expiring')
                    ->where('created_at', '>=', now()->subDays(3))
                    ->exists();

                if ($existing) {
                    continue;
                }

                Notification::notify(
                    $contract->tenant_id,
                    $admin->id,
                    'contract_expiring',
                    'Contrato vencendo',
                    [
                        'message' => "Contrato #{$contract->id} do cliente {$contract->customer?->name} vence em {$daysLeft} dia(s) ({$contract->end_date->format('d/m/Y')})",
                        'notifiable_type' => RecurringContract::class,
                        'notifiable_id' => $contract->id,
                    ]
                );
                $count++;
            }
        }

        $this->info("Sent {$count} expiring contract alert(s) for {$contracts->count()} contract(s).");
        return self::SUCCESS;
    }
}
