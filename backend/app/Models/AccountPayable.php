<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class AccountPayable extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $table = 'accounts_payable';

    protected $fillable = [
        'tenant_id', 'created_by', 'supplier', 'category',
        'description', 'amount', 'amount_paid', 'due_date', 'paid_at',
        'status', 'payment_method', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'due_date' => 'date',
            'paid_at' => 'date',
        ];
    }

    public const CATEGORIES = [
        'fornecedor' => 'Fornecedor',
        'aluguel' => 'Aluguel',
        'salario' => 'Salário',
        'imposto' => 'Imposto',
        'servico' => 'Serviço',
        'manutencao' => 'Manutenção',
        'outros' => 'Outros',
    ];

    public function recalculateStatus(): void
    {
        if ($this->amount_paid >= $this->amount) {
            $this->update(['status' => 'paid', 'paid_at' => now()]);
        } elseif ($this->amount_paid > 0) {
            $this->update(['status' => 'partial']);
        }
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }
}
