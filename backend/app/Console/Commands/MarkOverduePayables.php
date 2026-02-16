<?php

namespace App\Console\Commands;

use App\Models\AccountPayable;
use App\Models\Role;
use App\Models\User;
use App\Notifications\PaymentOverdue;
use Illuminate\Console\Command;

class MarkOverduePayables extends Command
{
    protected $signature = 'app:mark-overdue-payables';
    protected $description = 'Marca contas a pagar vencidas (pending + due_date < hoje) como overdue';

    public function handle(): int
    {
        $overdue = AccountPayable::where('status', AccountPayable::STATUS_PENDING)
            ->where('due_date', '<', now()->startOfDay())
            ->get();

        if ($overdue->isEmpty()) {
            $this->info('Nenhuma conta a pagar vencida encontrada.');
            return self::SUCCESS;
        }

        AccountPayable::whereIn('id', $overdue->pluck('id'))
            ->update(['status' => AccountPayable::STATUS_OVERDUE]);

        $byTenant = $overdue->groupBy('tenant_id');
        foreach ($byTenant as $tenantId => $payables) {
            $managers = User::whereHas('tenants', fn($q) => $q->where('tenants.id', $tenantId))
                ->whereHas('roles', fn($q) => $q->whereIn('name', [Role::ADMIN, Role::FINANCEIRO, Role::GERENTE]))
                ->get();

            foreach ($payables as $payable) {
                foreach ($managers as $manager) {
                    $manager->notify(new PaymentOverdue($payable));
                }
            }
        }

        $this->info("Marcadas {$overdue->count()} conta(s) a pagar como vencida(s). Gestores notificados.");

        return self::SUCCESS;
    }
}
