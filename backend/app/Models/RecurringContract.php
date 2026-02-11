<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class RecurringContract extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id', 'customer_id', 'equipment_id', 'assigned_to', 'created_by',
        'name', 'description', 'frequency', 'billing_type', 'monthly_value',
        'start_date', 'end_date',
        'next_run_date', 'priority', 'is_active', 'generated_count',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'next_run_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    // --- Relationships ---

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(RecurringContractItem::class);
    }

    // --- Logic ---

    public function advanceNextRunDate(): void
    {
        $next = Carbon::parse($this->next_run_date);

        $this->next_run_date = match ($this->frequency) {
            'weekly' => $next->addWeek(),
            'biweekly' => $next->addWeeks(2),
            'monthly' => $next->addMonth(),
            'bimonthly' => $next->addMonths(2),
            'quarterly' => $next->addQuarter(),
            'semiannual' => $next->addMonths(6),
            'annual' => $next->addYear(),
        };

        $this->generated_count++;

        if ($this->end_date && $this->next_run_date->gt($this->end_date)) {
            $this->is_active = false;
        }

        $this->save();
    }

    /** Gera a OS com itens a partir do template do contrato */
    public function generateWorkOrder(): WorkOrder
    {
        $tenantId = $this->tenant_id;

        $wo = WorkOrder::create([
            'tenant_id' => $tenantId,
            'number' => WorkOrder::nextNumber($tenantId),
            'recurring_contract_id' => $this->id,
            'customer_id' => $this->customer_id,
            'equipment_id' => $this->equipment_id,
            'assigned_to' => $this->assigned_to,
            'created_by' => $this->created_by,
            'origin_type' => WorkOrder::ORIGIN_RECURRING,
            'status' => WorkOrder::STATUS_OPEN,
            'priority' => $this->priority,
            'description' => "[Contrato Recorrente] {$this->name}\n{$this->description}",
            'received_at' => now(),
        ]);

        $wo->statusHistory()->create([
            'tenant_id' => $tenantId,
            'user_id' => $this->created_by,
            'to_status' => WorkOrder::STATUS_OPEN,
            'notes' => "OS gerada automaticamente pelo contrato recorrente: {$this->name}",
        ]);

        foreach ($this->items as $item) {
            $wo->items()->create([
                'type' => $item->type,
                'description' => $item->description,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'total' => $item->quantity * $item->unit_price,
            ]);
        }

        $wo->recalculateTotal();
        $this->advanceNextRunDate();

        return $wo;
    }

    /** Gera faturamento direto (Conta a Receber) para contratos fixed_monthly */
    public function generateBilling(): ?AccountReceivable
    {
        if ($this->billing_type !== 'fixed_monthly' || !$this->monthly_value) {
            return null;
        }

        $period = now()->format('Y-m');
        $billingKey = "recurring_contract:{$this->id}:{$period}";

        $alreadyBilled = AccountReceivable::where('tenant_id', $this->tenant_id)
            ->where('notes', $billingKey)
            ->first();

        if ($alreadyBilled) {
            return $alreadyBilled;
        }

        $ar = AccountReceivable::create([
            'tenant_id' => $this->tenant_id,
            'customer_id' => $this->customer_id,
            'created_by' => $this->created_by,
            'description' => "Contrato Recorrente: {$this->name} - " . now()->format('m/Y'),
            'notes' => $billingKey,
            'amount' => $this->monthly_value,
            'amount_paid' => 0,
            'due_date' => now()->addDays(30),
            'status' => AccountReceivable::STATUS_PENDING,
        ]);

        $this->advanceNextRunDate();

        return $ar;
    }
}
