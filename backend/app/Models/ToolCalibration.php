<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolCalibration extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'tool_inventory_id', 'calibration_date', 'next_due_date',
        'certificate_number', 'laboratory', 'result', 'certificate_file',
        'cost', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'calibration_date' => 'date',
            'next_due_date' => 'date',
            'cost' => 'decimal:2',
        ];
    }

    public function tool(): BelongsTo { return $this->belongsTo(ToolInventory::class, 'tool_inventory_id'); }

    public function scopeExpiring($query, int $days = 30)
    {
        return $query->where('next_due_date', '<=', now()->addDays($days))
            ->where('next_due_date', '>=', now());
    }
}
