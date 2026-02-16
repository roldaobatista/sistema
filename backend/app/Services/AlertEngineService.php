<?php

namespace App\Services;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\AlertConfiguration;
use App\Models\Commitment;
use App\Models\Customer;
use App\Models\DebtRenegotiation;
use App\Models\Equipment;
use App\Models\Expense;
use App\Models\FollowUp;
use App\Models\ImportantDate;
use App\Models\Product;
use App\Models\Quote;
use App\Models\RecurringContract;
use App\Models\ServiceCall;
use App\Models\StandardWeight;
use App\Models\Supplier;
use App\Models\SupplierContract;
use App\Models\SystemAlert;
use App\Models\ToolCalibration;
use App\Models\WorkOrder;
use App\Models\Fleet\VehicleInsurance;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

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
        $results['calibration_overdue'] = $this->checkCalibrationOverdue($tenantId);
        $results['weight_cert_expiring'] = $this->checkExpiringWeightCerts($tenantId);
        $results['quote_expiring'] = $this->checkExpiringQuotes($tenantId);
        $results['quote_expired'] = $this->checkQuoteExpired($tenantId);
        $results['overdue_receivable'] = $this->checkOverdueReceivables($tenantId);
        $results['tool_cal_expiring'] = $this->checkExpiringToolCalibrations($tenantId);
        $results['tool_cal_overdue'] = $this->checkToolCalOverdue($tenantId);
        $results['expense_pending'] = $this->checkExpensePending($tenantId);
        $results['low_stock'] = $this->checkLowStock($tenantId);
        $results['overdue_payable'] = $this->checkOverduePayables($tenantId);
        $results['expiring_payable'] = $this->checkExpiringPayables($tenantId);
        $results['expiring_fleet_insurance'] = $this->checkExpiringFleetInsurance($tenantId);
        $results['expiring_supplier_contract'] = $this->checkExpiringSupplierContracts($tenantId);
        $results['commitment_overdue'] = $this->checkCommitmentOverdue($tenantId);
        $results['important_date_upcoming'] = $this->checkImportantDateUpcoming($tenantId);
        $results['customer_no_contact'] = $this->checkCustomerNoContact($tenantId);
        $results['overdue_follow_up'] = $this->checkOverdueFollowUp($tenantId);
        $results['unattended_service_call'] = $this->checkUnattendedServiceCalls($tenantId);
        $results['renegotiation_pending'] = $this->checkRenegotiationPending($tenantId);
        $results['receivables_concentration'] = $this->checkReceivablesConcentration($tenantId);
        $results['scheduled_wo_not_started'] = $this->checkScheduledWoNotStarted($tenantId);

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
            ->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<=', now()->addDays($days))
            ->where('next_calibration_at', '>=', now())
            ->with('customer')
            ->get();

        $count = 0;
        foreach ($equipments as $equip) {
            if ($this->alertExists($tenantId, 'expiring_calibration', $equip)) continue;

            $daysLeft = $equip->next_calibration_at->diffInDays(now(), false);
            $this->createAlert($tenantId, 'expiring_calibration', $daysLeft <= 7 ? 'high' : 'medium',
                "Calibração do equipamento {$equip->code} vence em {$daysLeft} dias",
                "O equipamento {$equip->code} ({$equip->brand} {$equip->model}) do cliente {$equip->customer?->name} precisa ser recalibrado até {$equip->next_calibration_at->format('d/m/Y')}.",
                $equip, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkCalibrationOverdue(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'calibration_overdue');
        if (!$config?->is_enabled) return 0;

        $equipments = Equipment::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<', now())
            ->with('customer')
            ->get();

        $count = 0;
        foreach ($equipments as $equip) {
            if ($this->alertExists($tenantId, 'calibration_overdue', $equip)) continue;

            $daysOver = now()->diffInDays($equip->next_calibration_at);
            $this->createAlert($tenantId, 'calibration_overdue', 'critical',
                "Calibração vencida: equipamento {$equip->code}",
                "O equipamento {$equip->code} ({$equip->brand} {$equip->model}) do cliente {$equip->customer?->name} está com calibração vencida há {$daysOver} dias ({$equip->next_calibration_at->format('d/m/Y')}).",
                $equip, $config->channels ?? ['system', 'push']
            );
            $count++;
        }

        return $count;
    }

    public function checkQuoteExpired(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'quote_expired');
        if (!$config?->is_enabled) return 0;

        $quotes = Quote::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['sent', 'pending'])
            ->whereNotNull('valid_until')
            ->where('valid_until', '<', now())
            ->with('customer')
            ->get();

        $count = 0;
        foreach ($quotes as $quote) {
            if ($this->alertExists($tenantId, 'quote_expired', $quote)) continue;

            $this->createAlert($tenantId, 'quote_expired', 'critical',
                "Orçamento #{$quote->quote_number} expirado",
                "O orçamento #{$quote->quote_number} para {$quote->customer?->name} (R$ {$quote->total}) expirou em {$quote->valid_until->format('d/m/Y')} e segue em status pendente.",
                $quote, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkToolCalOverdue(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'tool_cal_overdue');
        if (!$config?->is_enabled) return 0;

        if (!method_exists(ToolCalibration::class, 'scopeExpiring')) {
            return 0;
        }

        $overdue = ToolCalibration::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('next_due_date', '<', now())
            ->with('tool')
            ->get();

        $count = 0;
        foreach ($overdue as $cal) {
            if ($this->alertExists($tenantId, 'tool_cal_overdue', $cal)) continue;

            $this->createAlert($tenantId, 'tool_cal_overdue', 'critical',
                "Calibração vencida: ferramenta {$cal->tool?->name}",
                "A calibração da ferramenta {$cal->tool?->name} (certificado: {$cal->certificate_number}) venceu em {$cal->next_due_date->format('d/m/Y')}.",
                $cal, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpensePending(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'expense_pending');
        $days = $config?->days_before ?? 3;
        if (!$config?->is_enabled) return 0;

        $expenses = Expense::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', Expense::STATUS_PENDING)
            ->where('created_at', '<=', now()->subDays($days))
            ->get();

        $count = 0;
        foreach ($expenses as $exp) {
            if ($this->alertExists($tenantId, 'expense_pending', $exp)) continue;

            $this->createAlert($tenantId, 'expense_pending', 'medium',
                "Despesa pendente de aprovação há {$days}+ dias",
                "Despesa de R$ {$exp->amount} ({$exp->description}) aguardando aprovação desde {$exp->created_at->format('d/m/Y')}.",
                $exp, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkLowStock(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'low_stock');
        if (!$config?->is_enabled) return 0;

        $products = Product::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('stock_min', '>', 0)
            ->whereColumn('stock_qty', '<=', 'stock_min')
            ->get();

        $count = 0;
        foreach ($products as $product) {
            if ($this->alertExists($tenantId, 'low_stock', $product)) continue;

            $deficit = $product->stock_min - $product->stock_qty;
            $this->createAlert($tenantId, 'low_stock', 'high',
                "Estoque baixo: {$product->name}",
                "Produto \"{$product->name}\" (#{$product->code}) — atual: {$product->stock_qty} {$product->unit}, mínimo: {$product->stock_min} {$product->unit} (déficit: {$deficit}).",
                $product, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkOverduePayables(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'overdue_payable');
        if (!$config?->is_enabled) return 0;
        if (!Schema::hasTable('accounts_payable')) return 0;

        $overdue = AccountPayable::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', [AccountPayable::STATUS_PENDING, AccountPayable::STATUS_OVERDUE])
            ->where('due_date', '<', now())
            ->get();

        $count = 0;
        foreach ($overdue as $ap) {
            if ($this->alertExists($tenantId, 'overdue_payable', $ap)) continue;

            $daysOver = now()->diffInDays($ap->due_date);
            $supplier = $ap->supplier_id ? (Supplier::find($ap->supplier_id)?->name ?? 'N/A') : 'N/A';
            $this->createAlert($tenantId, 'overdue_payable', $daysOver > 30 ? 'critical' : 'high',
                "Conta a pagar em atraso ({$daysOver}d) — {$supplier}",
                "Conta a pagar de R$ {$ap->amount} vencida em {$ap->due_date->format('d/m/Y')} ({$daysOver} dias). Fornecedor: {$supplier}.",
                $ap, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringPayables(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'expiring_payable');
        $days = $config?->days_before ?? 5;
        if (!$config?->is_enabled) return 0;
        if (!Schema::hasTable('accounts_payable')) return 0;

        $expiring = AccountPayable::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', AccountPayable::STATUS_PENDING)
            ->where('due_date', '>=', now())
            ->where('due_date', '<=', now()->addDays($days))
            ->get();

        $count = 0;
        foreach ($expiring as $ap) {
            if ($this->alertExists($tenantId, 'expiring_payable', $ap)) continue;

            $supplier = $ap->supplier_id ? (Supplier::find($ap->supplier_id)?->name ?? 'N/A') : 'N/A';
            $this->createAlert($tenantId, 'expiring_payable', 'medium',
                "Conta a pagar vencendo em {$ap->due_date->format('d/m/Y')}",
                "Conta a pagar de R$ {$ap->amount} vence em {$ap->due_date->format('d/m/Y')}. Fornecedor: {$supplier}.",
                $ap, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringFleetInsurance(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'expiring_fleet_insurance');
        $days = $config?->days_before ?? 30;
        if (!$config?->is_enabled) return 0;
        if (!Schema::hasTable('vehicle_insurances')) return 0;

        $expiring = VehicleInsurance::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->where('end_date', '>=', now())
            ->where('end_date', '<=', now()->addDays($days))
            ->with('vehicle')
            ->get();

        $count = 0;
        foreach ($expiring as $ins) {
            if ($this->alertExists($tenantId, 'expiring_fleet_insurance', $ins)) continue;

            $plate = $ins->vehicle?->plate ?? 'N/A';
            $daysLeft = $ins->end_date->diffInDays(now(), false);
            $this->createAlert($tenantId, 'expiring_fleet_insurance', $daysLeft <= 7 ? 'high' : 'medium',
                "Seguro do veículo {$plate} vence em {$daysLeft} dias",
                "O seguro do veículo {$plate} vence em {$ins->end_date->format('d/m/Y')}.",
                $ins, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkExpiringSupplierContracts(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'expiring_supplier_contract');
        $days = $config?->days_before ?? 30;
        if (!$config?->is_enabled) return 0;
        if (!Schema::hasTable('supplier_contracts')) return 0;

        $contracts = SupplierContract::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('end_date')
            ->where('end_date', '>=', now())
            ->where('end_date', '<=', now()->addDays($days))
            ->with('supplier:id,name')
            ->get();

        $count = 0;
        foreach ($contracts as $c) {
            if ($this->alertExists($tenantId, 'expiring_supplier_contract', $c)) continue;

            $daysLeft = $c->end_date->diffInDays(now(), false);
            $name = $c->supplier?->name ?? $c->title;
            $this->createAlert($tenantId, 'expiring_supplier_contract', 'high',
                "Contrato de fornecedor vence em {$daysLeft} dias",
                "Contrato \"{$c->title}\" do fornecedor {$name} vence em {$c->end_date->format('d/m/Y')}.",
                $c, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkCommitmentOverdue(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'commitment_overdue');
        if (!$config?->is_enabled) return 0;
        if (!Schema::hasTable('commitments')) return 0;

        $overdue = Commitment::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->where('due_date', '<', today())
            ->with('customer:id,name')
            ->get();

        $count = 0;
        foreach ($overdue as $comm) {
            if ($this->alertExists($tenantId, 'commitment_overdue', $comm)) continue;

            $this->createAlert($tenantId, 'commitment_overdue', 'high',
                "Compromisso atrasado: {$comm->title}",
                "Compromisso \"{$comm->title}\" do cliente {$comm->customer?->name} venceu em {$comm->due_date->format('d/m/Y')}.",
                $comm, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkImportantDateUpcoming(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'important_date_upcoming');
        $days = $config?->days_before ?? 7;
        if (!$config?->is_enabled) return 0;
        if (!Schema::hasTable('important_dates')) return 0;

        $upcoming = ImportantDate::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereBetween('date', [now()->toDateString(), now()->addDays($days)->toDateString()])
            ->with('customer:id,name')
            ->get();

        $count = 0;
        foreach ($upcoming as $id) {
            if ($this->alertExists($tenantId, 'important_date_upcoming', $id)) continue;

            $typeLabel = ImportantDate::TYPES[$id->type] ?? $id->type;
            $this->createAlert($tenantId, 'important_date_upcoming', 'medium',
                "Data importante: {$typeLabel} — {$id->customer?->name}",
                "{$typeLabel}: {$id->title} em {$id->date->format('d/m/Y')} para {$id->customer?->name}.",
                $id, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkCustomerNoContact(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'customer_no_contact');
        $days = $config?->days_before ?? 90;
        if (!$config?->is_enabled) return 0;

        $customers = Customer::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->noContactSince($days)
            ->limit(50)
            ->get();

        $count = 0;
        foreach ($customers as $cust) {
            if ($this->alertExists($tenantId, 'customer_no_contact', $cust)) continue;

            $last = $cust->last_contact_at ? $cust->last_contact_at->format('d/m/Y') : 'nunca';
            $this->createAlert($tenantId, 'customer_no_contact', 'medium',
                "Cliente sem contato há {$days}+ dias: {$cust->name}",
                "Cliente {$cust->name} sem contato há mais de {$days} dias (último: {$last}).",
                $cust, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkOverdueFollowUp(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'overdue_follow_up');
        if (!$config?->is_enabled) return 0;

        $overdue = FollowUp::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->where('scheduled_at', '<', now())
            ->get();

        $count = 0;
        foreach ($overdue as $fu) {
            if ($this->alertExists($tenantId, 'overdue_follow_up', $fu)) continue;

            $this->createAlert($tenantId, 'overdue_follow_up', 'high',
                "Follow-up em atraso",
                "Follow-up agendado para {$fu->scheduled_at->format('d/m/Y H:i')} não foi realizado.",
                $fu, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkUnattendedServiceCalls(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'unattended_service_call');
        $minutes = $config?->days_before ? (int) $config->days_before * 24 * 60 : 30;
        if (!$config?->is_enabled) return 0;

        $calls = ServiceCall::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', [ServiceCall::STATUS_OPEN, 'opened', 'pending'])
            ->where('created_at', '<', now()->subMinutes($minutes))
            ->with('customer:id,name')
            ->limit(20)
            ->get();

        $count = 0;
        foreach ($calls as $call) {
            if ($this->alertExists($tenantId, 'unattended_service_call', $call)) continue;

            $diffMin = now()->diffInMinutes($call->created_at);
            $sev = $diffMin > 60 ? 'critical' : 'high';
            $this->createAlert($tenantId, 'unattended_service_call', $sev,
                "Chamado #{$call->call_number} sem atendimento há {$diffMin} min",
                "Chamado #{$call->call_number} ({$call->customer?->name}) aberto há {$diffMin} minutos.",
                $call, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkRenegotiationPending(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'renegotiation_pending');
        $days = $config?->days_before ?? 3;
        if (!$config?->is_enabled) return 0;

        $pending = DebtRenegotiation::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subDays($days))
            ->with('customer:id,name')
            ->get();

        $count = 0;
        foreach ($pending as $r) {
            if ($this->alertExists($tenantId, 'renegotiation_pending', $r)) continue;

            $this->createAlert($tenantId, 'renegotiation_pending', 'high',
                "Renegociação pendente de aprovação",
                "Renegociação do cliente {$r->customer?->name} (R$ {$r->negotiated_total}) aguardando aprovação há mais de {$days} dias.",
                $r, $config->channels ?? ['system']
            );
            $count++;
        }

        return $count;
    }

    public function checkReceivablesConcentration(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'receivables_concentration');
        if (!$config?->is_enabled) return 0;

        $threshold = $config->threshold_amount ? (float) $config->threshold_amount : 50000;
        $total = AccountReceivable::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'overdue')
            ->where('due_date', '<', now())
            ->sum('amount');

        if ($total < $threshold) {
            return 0;
        }

        $existing = SystemAlert::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('alert_type', 'receivables_concentration')
            ->where('status', 'active')
            ->exists();

        if ($existing) {
            return 0;
        }

        $count = AccountReceivable::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('status', 'overdue')
            ->where('due_date', '<', now())
            ->count();

        $this->createAlert(
            $tenantId,
            'receivables_concentration',
            'critical',
            'Concentração de inadimplência',
            "Total de contas a receber em atraso: R$ " . number_format($total, 2, ',', '.') . " ({$count} títulos). Limite configurado: R$ " . number_format($threshold, 2, ',', '.') . ".",
            null,
            $config->channels ?? ['system']
        );

        return 1;
    }

    public function checkScheduledWoNotStarted(int $tenantId): int
    {
        $config = $this->getConfig($tenantId, 'scheduled_wo_not_started');
        $hours = $config?->days_before ? (int) $config->days_before * 24 : 24;
        if (!$config?->is_enabled) return 0;

        $wos = WorkOrder::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', [WorkOrder::STATUS_OPEN, WorkOrder::STATUS_AWAITING_DISPATCH])
            ->whereNotNull('received_at')
            ->where('received_at', '<', now()->subHours($hours))
            ->with('customer:id,name')
            ->limit(30)
            ->get();

        $count = 0;
        foreach ($wos as $wo) {
            if ($this->alertExists($tenantId, 'scheduled_wo_not_started', $wo)) continue;

            $h = now()->diffInHours($wo->received_at);
            $this->createAlert($tenantId, 'scheduled_wo_not_started', $h > 48 ? 'critical' : 'high',
                "OS #{$wo->business_number} recebida há {$h}h sem início",
                "A OS #{$wo->business_number} do cliente {$wo->customer?->name} foi recebida em {$wo->received_at->format('d/m/Y H:i')} e ainda não foi iniciada.",
                $wo, $config->channels ?? ['system']
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
        $q = SystemAlert::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->where('alert_type', $type)
            ->where('status', 'active');

        if ($model === null) {
            $q->whereNull('alertable_type')->whereNull('alertable_id');
        } else {
            $q->where('alertable_type', get_class($model))->where('alertable_id', $model->id);
        }

        return $q->exists();
    }

    private function isInBlackout(int $tenantId, string $alertType): bool
    {
        $config = $this->getConfig($tenantId, $alertType);
        if (!$config?->blackout_start || !$config?->blackout_end) {
            return false;
        }
        $current = now()->format('H:i');
        $start = $config->blackout_start;
        $end = $config->blackout_end;
        if ($start <= $end) {
            return $current >= $start && $current <= $end;
        }
        return $current >= $start || $current <= $end;
    }

    private function createAlert(int $tenantId, string $type, string $severity, string $title, string $message, $model, array $channels): SystemAlert
    {
        if ($this->isInBlackout($tenantId, $type)) {
            $channels = array_diff($channels, ['whatsapp', 'push']);
            if (empty($channels)) {
                $channels = ['system'];
            }
        }

        $alert = SystemAlert::create([
            'tenant_id' => $tenantId,
            'alert_type' => $type,
            'severity' => $severity,
            'title' => $title,
            'message' => $message,
            'alertable_type' => $model ? get_class($model) : null,
            'alertable_id' => $model?->id,
            'channels_sent' => $channels,
            'status' => 'active',
        ]);

        $this->dispatchToChannels($tenantId, $alert, $channels);

        return $alert;
    }

    /** Cria alerta de SLA na central (chamado por CheckSlaBreaches). */
    public function createAlertForSla(int $tenantId, WorkOrder $wo, string $label, string $message, array $channels): SystemAlert
    {
        return $this->createAlert(
            $tenantId,
            'sla_breach',
            'critical',
            "SLA Estourado ({$label}) — OS #{$wo->business_number}",
            $message,
            $wo,
            $channels
        );
    }

    /** Executa escalação: alertas críticos ativos há mais de X horas sem reconhecimento. */
    public function runEscalationChecks(int $tenantId): int
    {
        $configs = AlertConfiguration::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('escalation_recipients')
            ->where('escalation_hours', '>', 0)
            ->get();

        $escalated = 0;
        foreach ($configs as $config) {
            $alerts = SystemAlert::withoutGlobalScope('tenant')
                ->where('tenant_id', $tenantId)
                ->where('alert_type', $config->alert_type)
                ->where('severity', 'critical')
                ->where('status', 'active')
                ->whereNull('acknowledged_at')
                ->whereNull('escalated_at')
                ->where('created_at', '<=', now()->subHours($config->escalation_hours))
                ->get();

            foreach ($alerts as $alert) {
                if ($this->isInBlackout($tenantId, $alert->alert_type)) {
                    continue;
                }
                try {
                    $recipients = $config->escalation_recipients ?? [];
                    foreach ($recipients as $userId) {
                        $user = \App\Models\User::find($userId);
                        if ($user?->phone) {
                            $this->whatsApp->sendText($tenantId, $user->phone, "[ESCALAÇÃO] {$alert->title}\n\n{$alert->message}");
                        }
                    }
                    $alert->update(['escalated_at' => now()]);
                    $escalated++;
                } catch (\Throwable $e) {
                    Log::warning("Alert escalation failed for alert {$alert->id}: {$e->getMessage()}");
                }
            }
        }

        return $escalated;
    }

    private function dispatchToChannels(int $tenantId, SystemAlert $alert, array $channels): void
    {
        try {
            if (in_array('whatsapp', $channels)) {
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
