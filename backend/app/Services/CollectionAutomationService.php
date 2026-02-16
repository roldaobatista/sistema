<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\CollectionAction;
use App\Models\CollectionRule;
use Illuminate\Support\Facades\Log;

/**
 * Régua de cobrança automatizada.
 * Envia lembretes antes e depois do vencimento conforme regras configuradas.
 */
class CollectionAutomationService
{
    public function __construct(
        private WhatsAppService $whatsApp,
        private ClientNotificationService $notificationService,
    ) {}

    /**
     * Executa a régua de cobrança para todas as parcelas do tenant.
     */
    public function processForTenant(int $tenantId): array
    {
        $rules = CollectionRule::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('days_offset')
            ->get();

        if ($rules->isEmpty()) return ['processed' => 0, 'sent' => 0];

        $receivables = AccountReceivable::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['pending', 'overdue'])
            ->whereNotNull('due_date')
            ->with('customer')
            ->get();

        $sent = 0;
        foreach ($receivables as $ar) {
            foreach ($rules as $rule) {
                if ($this->shouldTrigger($ar, $rule) && !$this->alreadySent($ar, $rule)) {
                    $this->executeAction($tenantId, $ar, $rule);
                    $sent++;
                }
            }
        }

        return ['processed' => $receivables->count(), 'sent' => $sent];
    }

    private function shouldTrigger(AccountReceivable $ar, CollectionRule $rule): bool
    {
        $dueDate = $ar->due_date;
        $targetDate = $dueDate->copy()->addDays($rule->days_offset);

        return now()->isSameDay($targetDate) || (now()->isAfter($targetDate) && now()->diffInDays($targetDate) <= 1);
    }

    private function alreadySent(AccountReceivable $ar, CollectionRule $rule): bool
    {
        return CollectionAction::where('collection_rule_id', $rule->id)
            ->where('account_receivable_id', $ar->id)
            ->whereIn('status', ['sent', 'delivered'])
            ->exists();
    }

    private function executeAction(int $tenantId, AccountReceivable $ar, CollectionRule $rule): void
    {
        $customer = $ar->customer;
        if (!$customer) return;

        $message = $this->buildMessage($ar, $rule);

        $action = CollectionAction::create([
            'tenant_id' => $tenantId,
            'collection_rule_id' => $rule->id,
            'account_receivable_id' => $ar->id,
            'channel' => $rule->channel ?? 'email',
            'status' => 'pending',
            'scheduled_at' => now(),
        ]);

        try {
            match ($rule->channel) {
                'whatsapp' => $this->sendViaWhatsApp($tenantId, $customer, $message, $ar),
                'email' => $this->sendViaEmail($customer, $message, $ar),
                'sms' => $this->sendViaSms($customer, $message),
                default => Log::info("Collection action channel not implemented: {$rule->channel}"),
            };

            $action->update(['status' => 'sent', 'sent_at' => now()]);
        } catch (\Throwable $e) {
            $action->update(['status' => 'failed']);
            Log::error("Collection automation failed: {$e->getMessage()}");
        }
    }

    private function buildMessage(AccountReceivable $ar, CollectionRule $rule): string
    {
        $daysOverdue = $ar->due_date->isPast() ? now()->diffInDays($ar->due_date) : 0;
        $customer = $ar->customer;

        if ($rule->days_offset < 0) {
            // Lembrete ANTES do vencimento
            $daysUntil = abs($rule->days_offset);
            return "Olá, {$customer->name}! Lembrete: a parcela de R$ " . number_format($ar->amount, 2, ',', '.') .
                " vence em {$daysUntil} dia(s) ({$ar->due_date->format('d/m/Y')}). Em caso de dúvidas, entre em contato.";
        }

        if ($rule->days_offset === 0) {
            return "Olá, {$customer->name}! A parcela de R$ " . number_format($ar->amount, 2, ',', '.') .
                " vence hoje ({$ar->due_date->format('d/m/Y')}). Caso já tenha efetuado o pagamento, desconsidere.";
        }

        // Cobrança APÓS vencimento
        return "Olá, {$customer->name}. Identificamos que a parcela de R$ " . number_format($ar->amount, 2, ',', '.') .
            " com vencimento em {$ar->due_date->format('d/m/Y')} encontra-se em atraso há {$daysOverdue} dia(s). " .
            "Pedimos a gentileza de regularizar. Caso já tenha pago, desconsidere.";
    }

    private function sendViaWhatsApp(int $tenantId, $customer, string $message, $ar): void
    {
        $phone = $customer->phone ?? $customer->contacts()->first()?->phone;
        if ($phone) {
            $this->whatsApp->sendText($tenantId, $phone, $message, $ar);
        }
    }

    private function sendViaEmail($customer, string $message, $ar): void
    {
        $email = $customer->email ?? $customer->contacts()->first()?->email;
        if ($email) {
            \Illuminate\Support\Facades\Mail::raw($message, function ($m) use ($email, $ar) {
                $m->to($email)->subject("Lembrete de pagamento — Parcela R$ " . number_format($ar->amount, 2, ',', '.'));
            });
        }
    }

    private function sendViaSms($customer, string $message): void
    {
        $phone = $customer->phone ?? $customer->contacts()->first()?->phone;
        if (!$phone) {
            Log::warning('Collection SMS skipped: customer has no phone', ['customer_id' => $customer->id]);
            return;
        }

        // SMS integration requires external provider (Twilio, Vonage, etc.)
        // For now, log the attempt. When an SMS provider is configured, replace this.
        Log::info('Collection SMS queued', [
            'customer_id' => $customer->id,
            'phone' => $phone,
            'message_length' => strlen($message),
        ]);
    }
}
