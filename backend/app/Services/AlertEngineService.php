<?php

namespace App\Services;

use App\Models\AlertConfiguration;
use App\Models\Equipment;
use App\Models\Quote;
use App\Models\RecurringContract;
use App\Models\StandardWeight;
use App\Models\SystemAlert;
use App\Models\ToolCalibration;
use App\Models\WorkOrder;
use App\Models\AccountReceivable;
use Illuminate\Support\Facades\Log;

class AlertEngineService
{
    public function __construct(
        private WhatsAppService $whatsApp,
        private WebPushService $webPush,
    ) {}

    /**
     * Executa todas as verificações de alerta para um tenant.
     */
    public function runAllChecks(int $tenantId): array
    {
        $results = [];

        $results['unbilled_wo'] = $this->checkUnbilledWorkOrders($tenantId);
        $results['expiring_contract'] = $this->checkExpiringContracts($tenantId);
        $results['expiring_calibration'] = $this->checkExpiringCalibrations($tenantId);
        $results['weight_cert_expiring'] = $this->checkExpiringWeightCerts($tenantId);
        $results['quote_expiring'] = $this->checkExpiringQuotes($tenantId);
        $results['overdue_receivable'] = $this->checkOverdueReceivables($tenantId);
        $results['tool_cal_expiring'] = $this->checkExpiringToolCalibrations($tenantId);

        return $results;
    }

    public function checkUnbilledWorkOrders(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'unbilled_wo');
        if (!$config?->is_enabled) return 0;

        $unbilled = WorkOrder::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'completed')
            ->where('completed_at', '<', now()->subHours(24))
            ->get();

        $count = 0;
        foreach ($unbilled as $wo) {
            if ($this->alertExists($tenantId, 'unbilled_wo', $wo)) continue;

            $this->createAlert($tenantId, 'unbilled_wo', 'critical',
                "OS #{$wo->business_number} concluída sem faturamento",
                "A OS #{$wo->business_number} do cliente {$wo->customer?->name} foi concluída há mais de 24h e ainda não foi faturada.",
                $wo, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringContracts(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'expiring_contract');
        $days = $config?->days_before ?? 7;
        if (!$config?->is_enabled) return 0;

        $contracts = RecurringContract::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('next_execution_date', '<=', now()->addDays($days))
            ->where('next_execution_date', '>=', now())
            ->get();

        $count = 0;
        foreach ($contracts as $contract) {
            if ($this->alertExists($tenantId, 'expiring_contract', $contract)) continue;

            $this->createAlert($tenantId, 'expiring_contract', 'high',
                "Contrato #{$contract->id} vence em {$contract->next_execution_date->diffInDays(now())} dias",
                "O contrato recorrente do cliente {$contract->customer?->name} tem execução programada para {$contract->next_execution_date->format('d/m/Y')}.",
                $contract, $config->channels ?? ['system', 'whatsapp']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringCalibrations(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'expiring_calibration');
        $days = $config?->days_before ?? 30;
        if (!$config?->is_enabled) return 0;

        $equipments = Equipment::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('next_calibration_date')
            ->where('next_calibration_date', '<=', now()->addDays($days))
            ->where('next_calibration_date', '>=', now())
            ->with('customer')
            ->get();

        $count = 0;
        foreach ($equipments as $equip) {
            if ($this->alertExists($tenantId, 'expiring_calibration', $equip)) continue;

            $daysLeft = $equip->next_calibration_date->diffInDays(now());
            $this->createAlert($tenantId, 'expiring_calibration', $daysLeft <= 7 ? 'high' : 'medium',
                "Calibração do equipamento {$equip->code} vence em {$daysLeft} dias",
                "O equipamento {$equip->code} ({$equip->brand} {$equip->model}) do cliente {$equip->customer?->name} precisa ser recalibrado até {$equip->next_calibration_date->format('d/m/Y')}.",
                $equip, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringWeightCerts(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'weight_cert_expiring');
        $days = $config?->days_before ?? 60;
        if (!$config?->is_enabled) return 0;

        $weights = StandardWeight::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->expiring($days)
            ->get();

        $count = 0;
        foreach ($weights as $weight) {
            if ($this->alertExists($tenantId, 'weight_cert_expiring', $weight)) continue;

            $daysLeft = $weight->certificate_expiry->diffInDays(now());
            $this->createAlert($tenantId, 'weight_cert_expiring', 'high',
                "Certificado do peso {$weight->code} vence em {$daysLeft} dias",
                "O peso padrão {$weight->display_name} (certificado: {$weight->certificate_number}) vence em {$weight->certificate_expiry->format('d/m/Y')}. Sem certificado válido, as calibrações ficam inválidas.",
                $weight, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringQuotes(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'quote_expiring');
        $days = $config?->days_before ?? 5;
        if (!$config?->is_enabled) return 0;

        $quotes = Quote::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['sent', 'pending'])
            ->whereNotNull('valid_until')
            ->where('valid_until', '<=', now()->addDays($days))
            ->where('valid_until', '>=', now())
            ->with('customer')
            ->get();

        $count = 0;
        foreach ($quotes as $quote) {
            if ($this->alertExists($tenantId, 'quote_expiring', $quote)) continue;

            $daysLeft = $quote->valid_until->diffInDays(now());
            $this->createAlert($tenantId, 'quote_expiring', 'medium',
                "Orçamento #{$quote->quote_number} vence em {$daysLeft} dias",
                "O orçamento #{$quote->quote_number} para {$quote->customer?->name} (R$ {$quote->total}) vence em {$quote->valid_until->format('d/m/Y')}.",
                $quote, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkOverdueReceivables(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'overdue_receivable');
        if (!$config?->is_enabled) return 0;

        $overdue = AccountReceivable::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'overdue')
            ->where('due_date', '<', now())
            ->with('customer')
            ->get();

        $count = 0;
        foreach ($overdue as $ar) {
            if ($this->alertExists($tenantId, 'overdue_receivable', $ar)) continue;

            $daysOverdue = now()->diffInDays($ar->due_date);
            $severity = $daysOverdue > 30 ? 'critical' : ($daysOverdue > 7 ? 'high' : 'medium');

            $this->createAlert($tenantId, 'overdue_receivable', $severity,
                "Conta a receber em atraso ({$daysOverdue} dias) — {$ar->customer?->name}",
                "O cliente {$ar->customer?->name} tem parcela de R$ {$ar->amount} vencida desde {$ar->due_date->format('d/m/Y')} ({$daysOverdue} dias de atraso).",
                $ar, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringToolCalibrations(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'tool_cal_expiring');
        $days = $config?->days_before ?? 30;
        if (!$config?->is_enabled) return 0;

        $expiring = ToolCalibration::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->expiring($days)
            ->with('tool')
            ->get();

        $count = 0;
        foreach ($expiring as $cal) {
            if ($this->alertExists($tenantId, 'tool_cal_expiring', $cal)) continue;

            $daysLeft = $cal->next_due_date->diffInDays(now());
            $this->createAlert($tenantId, 'tool_cal_expiring', 'medium',
                "Ferramenta {$cal->tool?->name} com calibração vencendo em {$daysLeft} dias",
                "A calibração da ferramenta {$cal->tool?->name} (certificado: {$cal->certificate_number}) vence em {$cal->next_due_date->format('d/m/Y')}.",
                $cal, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private function getConfig(int $tenantId, string $alertType): ?AlertConfiguration
    {
        return AlertConfiguration::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('alert_type', $alertType)
            ->first();
    }

    private function alertExists(int $tenantId, string $type, $model): bool
    {
        return SystemAlert::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('alert_type', $type)
            ->where('alertable_type', get_class($model))
            ->where('alertable_id', $model->id)
            ->where('status', 'active')
            ->exists();
    }

    private function createAlert(int $tenantId, string $type, string $severity, string $title, string $message, $model, array $channels): SystemAlert
    {
        $alert = SystemAlert::create([
            'tenant_id' => $tenantId,
            'alert_type' => $type,
            'severity' => $severity,
            'title' => $title,
            'message' => $message,
            'alertable_type' => get_class($model),
            'alertable_id' => $model->id,
            'channels_sent' => $channels,
            'status' => 'active',
        ]);

        $this->dispatchToChannels($tenantId, $alert, $channels);

        return $alert;
    }

    private function dispatchToChannels(int $tenantId, SystemAlert $alert, array $channels): void
    {
        try {
            if (in_array('whatsapp', $channels)) {
                // Envia para admins configurados
                $config = $this->getConfig($tenantId, $alert->alert_type);
                $recipients = $config?->recipients ?? [];
                foreach ($recipients as $userId) {
                    $user = \App\Models\User::find($userId);
                    if ($user?->phone) {
                        $this->whatsApp->sendText($tenantId, $user->phone, "{$alert->title}\n\n{$alert->message}");
                    }
                }
            }

            if (in_array('push', $channels)) {
                $this->webPush->sendToTenant($tenantId, $alert->title, $alert->message);
            }
        } catch (\Throwable $e) {
            Log::warning("Alert dispatch failed for {$alert->alert_type}: {$e->getMessage()}");
        }
    }
}
