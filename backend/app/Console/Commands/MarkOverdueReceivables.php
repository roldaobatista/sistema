<?php

namespace App\Console\Commands;

use App\Models\AccountReceivable;
use App\Models\Role;
use App\Models\User;
use App\Notifications\PaymentOverdue;
use Illuminate\Console\Command;

class MarkOverdueReceivables extends Command
{
    protected $signature = 'app:mark-overdue-receivables';
    protected $description = 'Marca títulos a receber vencidos (pending + due_date < hoje) como overdue';

    public function handle(): int
    {
        $overdue = AccountReceivable::where('status', AccountReceivable::STATUS_PENDING)
            ->where('due_date', '<', now()->startOfDay())
            ->with('customer:id,name')
            ->get();

        if ($overdue->isEmpty()) {
            $this->info('Nenhum título vencido encontrado.');
            return self::SUCCESS;
        }

        // Atualizar status em lote
        AccountReceivable::whereIn('id', $overdue->pluck('id'))
            ->update(['status' => AccountReceivable::STATUS_OVERDUE]);

        // Notificar gestores financeiros (por tenant)
        $byTenant = $overdue->groupBy('tenant_id');
        foreach ($byTenant as $tenantId => $receivables) {
            $managers = User::whereHas('tenants', fn($q) => $q->where('tenants.id', $tenantId))
                ->whereHas('roles', fn($q) => $q->whereIn('name', [Role::ADMIN, Role::FINANCEIRO, Role::GERENTE]))
                ->get();

            foreach ($receivables as $receivable) {
                foreach ($managers as $manager) {
                    $manager->notify(new PaymentOverdue($receivable));
                }
            }
        }

        $this->info("Marcados {$overdue->count()} título(s) como vencido(s). Gestores notificados.");

        return self::SUCCESS;
    }
}
