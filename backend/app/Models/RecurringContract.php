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
        'name', 'description', 'frequency', 'start_date', 'end_date',
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

        $lastNumber = WorkOrder::where('tenant_id', $tenantId)->max('number') ?? 0;

        $wo = WorkOrder::create([
            'tenant_id' => $tenantId,
            'number' => $lastNumber + 1,
            'customer_id' => $this->customer_id,
            'equipment_id' => $this->equipment_id,
            'assigned_to' => $this->assigned_to,
            'created_by' => $this->created_by,
            'origin_type' => 'recurring_contract',
            'status' => 'open',
            'priority' => $this->priority,
            'description' => "[Contrato Recorrente] {$this->name}\n{$this->description}",
            'received_at' => now(),
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
}
