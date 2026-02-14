<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankStatement extends Model
{
    use BelongsToTenant, \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $fillable = [
        'tenant_id', 'bank_account_id', 'filename', 'format', 'imported_at',
        'created_by', 'total_entries', 'matched_entries',
    ];

    protected function casts(): array
    {
        return ['imported_at' => 'datetime'];
    }

    public function entries(): HasMany
    {
        return $this->hasMany(BankStatementEntry::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }
}
