<?php

namespace App\Services;

use App\Models\AccountReceivable;
use App\Models\Invoice;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

class InvoicingService
{
    public function generateFromWorkOrder(WorkOrder $wo, ?int $userId = null): array
    {
        $createdBy = $userId ?? auth()->id();

        return DB::transaction(function () use ($wo, $createdBy) {
            $invoice = Invoice::create([
                'tenant_id' => $wo->tenant_id,
                'work_order_id' => $wo->id,
                'customer_id' => $wo->customer_id,
                'created_by' => $createdBy,
                'invoice_number' => Invoice::nextNumber($wo->tenant_id),
                'status' => Invoice::STATUS_ISSUED,
                'total' => $wo->total,
                'issued_at' => now(),
                'due_date' => now()->addDays(30),
                'items' => $wo->items()->get()->map(fn ($item) => [
                    'description' => $item->description ?? $item->name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total' => $item->total,
                    'type' => $item->type,
                ])->toArray(),
            ]);

            $ar = AccountReceivable::create([
                'tenant_id' => $wo->tenant_id,
                'customer_id' => $wo->customer_id,
                'work_order_id' => $wo->id,
                'created_by' => $createdBy,
                'description' => "OS {$wo->business_number} - Fatura {$invoice->invoice_number}",
                'amount' => $wo->total,
                'amount_paid' => 0,
                'due_date' => now()->addDays(30),
                'status' => AccountReceivable::STATUS_PENDING,
            ]);

            return compact('invoice', 'ar');
        });
    }
}
