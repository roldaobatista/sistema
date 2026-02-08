<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class RecurringContractItem extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'recurring_contract_id', 'type', 'description', 'quantity', 'unit_price',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class, 'recurring_contract_id');
    }
}
