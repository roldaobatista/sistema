<?php

namespace App\Console\Commands;

use App\Models\AccountReceivable;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BillRecurringContracts extends Command
{
    protected $signature = 'contracts:bill-recurring';
    protected $description = 'Generate accounts receivable for active recurring contracts';

    public function handle(): int
    {
        $tenants = Tenant::where('status', Tenant::STATUS_ACTIVE)->get();
        $totalBilled = 0;

        foreach ($tenants as $tenant) {
            $contracts = RecurringContract::where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->where('billing_type', 'fixed_monthly')
                ->where('monthly_value', '>', 0)
                ->get();

            foreach ($contracts as $contract) {
                $period = now()->format('Y-m');
                $description = "Contrato Recorrente: {$contract->name} - " . now()->format('m/Y');
                $billingKey = "recurring_contract:{$contract->id}:{$period}";

                $alreadyBilled = AccountReceivable::where('tenant_id', $tenant->id)
                    ->where('notes', $billingKey)
                    ->exists();

                if ($alreadyBilled) {
                    continue;
                }

                DB::transaction(function () use ($tenant, $contract, $description, $billingKey) {
                    AccountReceivable::create([
                        'tenant_id' => $tenant->id,
                        'customer_id' => $contract->customer_id,
                        'created_by' => $contract->created_by,
                        'description' => $description,
                        'notes' => $billingKey,
                        'amount' => $contract->monthly_value,
                        'amount_paid' => 0,
                        'due_date' => now()->endOfMonth(),
                        'status' => AccountReceivable::STATUS_PENDING,
                    ]);
                });

                $totalBilled++;

                $admins = User::where('tenant_id', $tenant->id)->limit(2)->get();
                foreach ($admins as $admin) {
                    Notification::notify(
                        $tenant->id,
                        $admin->id,
                        'contract_billed',
                        'Contrato Faturado',
                        [
                            'message' => "Contrato {$contract->name} faturado automaticamente (R$ " . number_format((float) $contract->monthly_value, 2, ',', '.') . ").",
                            'icon' => 'repeat',
                            'color' => 'info',
                        ]
                    );
                }
            }
        }

        $this->info("{$totalBilled} contratos faturados com sucesso.");
        return self::SUCCESS;
    }
}
