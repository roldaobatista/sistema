<?php

namespace App\Console\Commands;

use App\Models\AccountReceivable;
use App\Models\Notification;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Console\Command;

class NotifyUpcomingPayments extends Command
{
    protected $signature = 'notify:upcoming-payments {--days=3 : Days before due date}';
    protected $description = 'Send notifications for payments due soon';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $targetDate = now()->addDays($days)->toDateString();

        $tenants = Tenant::where('status', Tenant::STATUS_ACTIVE)->get();
        $totalNotified = 0;

        foreach ($tenants as $tenant) {
            $upcomingAR = AccountReceivable::where('tenant_id', $tenant->id)
                ->where('status', AccountReceivable::STATUS_PENDING)
                ->whereDate('due_date', $targetDate)
                ->get();

            if ($upcomingAR->isEmpty()) {
                continue;
            }

            $admins = User::where('tenant_id', $tenant->id)
                ->limit(3)
                ->get();

            foreach ($upcomingAR as $ar) {
                foreach ($admins as $admin) {
                    Notification::notify(
                        $tenant->id,
                        $admin->id,
                        'payment_upcoming',
                        'Pagamento Próximo do Vencimento',
                        [
                            'message' => "Conta a receber \"{$ar->description}\" vence em {$days} dias (R$ " . number_format((float) $ar->amount, 2, ',', '.') . ").",
                            'icon' => 'clock',
                            'color' => 'warning',
                            'data' => ['account_receivable_id' => $ar->id, 'due_date' => $ar->due_date->format('d/m/Y')],
                        ]
                    );
                }
                $totalNotified++;
            }
        }

        $this->info("Notificações enviadas para {$totalNotified} contas a vencer.");
        return self::SUCCESS;
    }
}
