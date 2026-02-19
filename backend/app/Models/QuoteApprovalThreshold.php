<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class QuoteApprovalThreshold extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'min_value', 'max_value', 'required_level',
        'approver_role', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'min_value' => 'decimal:2',
            'max_value' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
