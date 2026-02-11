<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class BankStatementEntry extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'bank_statement_id', 'tenant_id', 'date', 'description',
        'amount', 'type', 'matched_type', 'matched_id', 'status',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public const STATUS_PENDING = 'pending';
    public const STATUS_MATCHED = 'matched';
    public const STATUS_IGNORED = 'ignored';

    public function statement(): BelongsTo
    {
        return $this->belongsTo(BankStatement::class, 'bank_statement_id');
    }

    public function matched(): MorphTo
    {
        return $this->morphTo('matched', 'matched_type', 'matched_id');
    }
}
