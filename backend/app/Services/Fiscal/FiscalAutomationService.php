<?php

namespace App\Services\Fiscal;

use App\Models\FiscalNote;
use App\Models\Tenant;
use App\Models\WorkOrder;
use App\Models\Quote;
use App\Models\FiscalScheduledEmission;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class FiscalAutomationService
{
    public function __construct(
        private FiscalProvider $provider,
        private FiscalNumberingService $numbering,
    ) {}

    /**
     * #6 — Emit NF-e/NFS-e automatically when a Work Order is closed.
     */
    public function emitOnWorkOrderClosed(WorkOrder $workOrder, string $type = 'nfse'): array
    {
        $tenant = $workOrder->tenant;
        if (! $tenant || ! $workOrder->customer_id) {
            return ['success' => false, 'error' => 'OS sem tenant ou cliente'];
        }

        $items = $this->buildItemsFromWorkOrder($workOrder);
        if (empty($items)) {
            return ['success' => false, 'error' => 'OS sem itens para faturar'];
        }

        try {
            $reference = FiscalNote::generateReference($type, $tenant->id);
            $numbering = $type === 'nfe'
                ? $this->numbering->nextNFeNumber($tenant)
                : $this->numbering->nextNFSeRpsNumber($tenant);

            $note = FiscalNote::create([
                'tenant_id' => $tenant->id,
                'type' => $type,
                'work_order_id' => $workOrder->id,
                'customer_id' => $workOrder->customer_id,
                'number' => $numbering['number'],
                'series' => $numbering['series'],
                'reference' => $reference,
                'status' => FiscalNote::STATUS_PROCESSING,
                'provider' => 'focus_nfe',
                'total_amount' => $workOrder->total_value ?? collect($items)->sum('valor_unitario'),
                'items_data' => $items,
                'nature_of_operation' => 'Prestação de Serviços',
                'issued_at' => now(),
                'created_by' => auth()->id(),
            ]);

            $data = ['ref' => $reference, 'items' => $items, 'customer_id' => $workOrder->customer_id];
            $result = $type === 'nfe'
                ? $this->provider->emitirNFe($data)
                : $this->provider->emitirNFSe($data);

            if ($result->success) {
                $note->update([
                    'status' => FiscalNote::STATUS_AUTHORIZED,
                    'provider_id' => $result->providerId,
                    'access_key' => $result->accessKey,
                    'raw_response' => $result->rawResponse,
                ]);
            } else {
                $note->update([
                    'status' => FiscalNote::STATUS_REJECTED,
                    'error_message' => $result->errorMessage,
                    'raw_response' => $result->rawResponse,
                ]);
            }

            Log::info('FiscalAutomation: auto-emit from WO', [
                'wo_id' => $workOrder->id, 'note_id' => $note->id, 'success' => $result->success,
            ]);

            return ['success' => $result->success, 'note_id' => $note->id, 'note' => $note->fresh()];
        } catch (\Exception $e) {
            Log::error('FiscalAutomation: auto-emit failed', ['wo_id' => $workOrder->id, 'error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * #7 — Batch emit fiscal notes for multiple work orders or quotes.
     */
    public function emitBatch(array $sourceIds, string $sourceType, string $noteType, int $tenantId, ?int $userId = null): array
    {
        $results = ['total' => count($sourceIds), 'success' => 0, 'failed' => 0, 'details' => []];

        foreach ($sourceIds as $id) {
            try {
                if ($sourceType === 'work_order') {
                    $source = WorkOrder::where('tenant_id', $tenantId)->findOrFail($id);
                    $result = $this->emitOnWorkOrderClosed($source, $noteType);
                } elseif ($sourceType === 'quote') {
                    $source = Quote::where('tenant_id', $tenantId)->findOrFail($id);
                    $result = $this->emitFromQuote($source, $noteType);
                } else {
                    $result = ['success' => false, 'error' => 'Tipo de origem inválido'];
                }

                if ($result['success']) {
                    $results['success']++;
                } else {
                    $results['failed']++;
                }
                $results['details'][] = ['source_id' => $id, ...$result];
            } catch (\Exception $e) {
                $results['failed']++;
                $results['details'][] = ['source_id' => $id, 'success' => false, 'error' => $e->getMessage()];
            }
        }

        return $results;
    }

    /**
     * #8 — Schedule a fiscal note emission for a future date.
     */
    public function scheduleEmission(array $data, Carbon $scheduledAt, int $tenantId, ?int $userId = null): FiscalScheduledEmission
    {
        return FiscalScheduledEmission::create([
            'tenant_id' => $tenantId,
            'type' => $data['type'] ?? 'nfse',
            'work_order_id' => $data['work_order_id'] ?? null,
            'quote_id' => $data['quote_id'] ?? null,
            'customer_id' => $data['customer_id'],
            'payload' => $data,
            'scheduled_at' => $scheduledAt,
            'status' => 'pending',
            'created_by' => $userId,
        ]);
    }

    /**
     * Process pending scheduled emissions (called by scheduler).
     */
    public function processScheduledEmissions(): array
    {
        $pending = FiscalScheduledEmission::where('status', 'pending')
            ->where('scheduled_at', '<=', now())
            ->limit(50)
            ->get();

        $results = ['processed' => 0, 'success' => 0, 'failed' => 0];

        foreach ($pending as $scheduled) {
            $scheduled->update(['status' => 'processing']);

            try {
                $payload = $scheduled->payload;
                if ($scheduled->work_order_id) {
                    $wo = WorkOrder::find($scheduled->work_order_id);
                    $result = $wo ? $this->emitOnWorkOrderClosed($wo, $scheduled->type) : ['success' => false, 'error' => 'OS não encontrada'];
                } else {
                    $result = ['success' => false, 'error' => 'Origem não definida'];
                }

                $scheduled->update([
                    'status' => $result['success'] ? 'completed' : 'failed',
                    'fiscal_note_id' => $result['note_id'] ?? null,
                    'error_message' => $result['error'] ?? null,
                ]);

                $results['processed']++;
                $result['success'] ? $results['success']++ : $results['failed']++;
            } catch (\Exception $e) {
                $scheduled->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
                $results['processed']++;
                $results['failed']++;
            }
        }

        return $results;
    }

    /**
     * #9 — Retry sending email with exponential backoff.
     */
    public function retryEmail(FiscalNote $note, int $maxRetries = 3): array
    {
        if ($note->email_retry_count >= $maxRetries) {
            return ['success' => false, 'error' => "Máximo de {$maxRetries} tentativas atingido"];
        }

        $emailService = app(FiscalEmailService::class);
        $result = $emailService->send($note);

        $note->update([
            'email_retry_count' => $note->email_retry_count + 1,
            'last_email_sent_at' => $result['success'] ? now() : $note->last_email_sent_at,
        ]);

        return $result;
    }

    private function emitFromQuote(Quote $quote, string $type): array
    {
        $tenant = $quote->tenant;
        $items = $this->buildItemsFromQuote($quote);
        if (empty($items)) {
            return ['success' => false, 'error' => 'Orçamento sem itens'];
        }

        $reference = FiscalNote::generateReference($type, $tenant->id);
        $numbering = $type === 'nfe'
            ? $this->numbering->nextNFeNumber($tenant)
            : $this->numbering->nextNFSeRpsNumber($tenant);

        $note = FiscalNote::create([
            'tenant_id' => $tenant->id,
            'type' => $type,
            'quote_id' => $quote->id,
            'customer_id' => $quote->customer_id,
            'number' => $numbering['number'],
            'series' => $numbering['series'],
            'reference' => $reference,
            'status' => FiscalNote::STATUS_PROCESSING,
            'provider' => 'focus_nfe',
            'total_amount' => $quote->total ?? collect($items)->sum('valor_unitario'),
            'items_data' => $items,
            'issued_at' => now(),
        ]);

        $data = ['ref' => $reference, 'items' => $items, 'customer_id' => $quote->customer_id];
        $result = $type === 'nfe'
            ? $this->provider->emitirNFe($data)
            : $this->provider->emitirNFSe($data);

        $note->update([
            'status' => $result->success ? FiscalNote::STATUS_AUTHORIZED : FiscalNote::STATUS_REJECTED,
            'provider_id' => $result->providerId,
            'access_key' => $result->accessKey,
            'error_message' => $result->errorMessage,
            'raw_response' => $result->rawResponse,
        ]);

        return ['success' => $result->success, 'note_id' => $note->id, 'note' => $note->fresh()];
    }

    private function buildItemsFromWorkOrder(WorkOrder $workOrder): array
    {
        $items = [];
        if ($workOrder->services) {
            foreach ((is_array($workOrder->services) ? $workOrder->services : json_decode($workOrder->services, true) ?? []) as $svc) {
                $items[] = [
                    'descricao' => $svc['description'] ?? $svc['name'] ?? 'Serviço',
                    'valor_unitario' => (float) ($svc['price'] ?? $svc['value'] ?? 0),
                    'quantidade' => (int) ($svc['quantity'] ?? 1),
                ];
            }
        }
        return $items;
    }

    private function buildItemsFromQuote(Quote $quote): array
    {
        $items = [];
        $quoteItems = $quote->items ?? [];
        foreach ((is_array($quoteItems) ? $quoteItems : json_decode($quoteItems, true) ?? []) as $item) {
            $items[] = [
                'descricao' => $item['description'] ?? $item['name'] ?? 'Item',
                'valor_unitario' => (float) ($item['unit_price'] ?? $item['price'] ?? 0),
                'quantidade' => (int) ($item['quantity'] ?? 1),
            ];
        }
        return $items;
    }
}
