<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    public const TYPE_CORRENTE = 'corrente';
    public const TYPE_POUPANCA = 'poupanca';
    public const TYPE_PAGAMENTO = 'pagamento';

    public const ACCOUNT_TYPES = [
        self::TYPE_CORRENTE => 'Conta Corrente',
        self::TYPE_POUPANCA => 'Poupança',
        self::TYPE_PAGAMENTO => 'Conta Pagamento',
    ];

    protected $fillable = [
        'tenant_id', 'name', 'bank_name', 'agency', 'account_number',
        'account_type', 'pix_key', 'balance', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function fundTransfers(): HasMany
    {
        return $this->hasMany(FundTransfer::class);
    }
}
