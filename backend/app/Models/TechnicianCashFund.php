<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TechnicianCashFund extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = ['tenant_id', 'user_id', 'balance', 'card_balance'];

    protected function casts(): array
    {
        return ['balance' => 'decimal:2', 'card_balance' => 'decimal:2'];
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(TechnicianCashTransaction::class, 'fund_id')->orderByDesc('transaction_date')->orderByDesc('id');
    }

    public function addCredit(float $amount, string $description, ?int $createdBy = null, ?int $workOrderId = null, string $paymentMethod = 'cash'): TechnicianCashTransaction
    {
        return DB::transaction(function () use ($amount, $description, $createdBy, $workOrderId, $paymentMethod) {
            $lockedFund = self::lockForUpdate()->findOrFail($this->id);

            $balanceField = $paymentMethod === 'corporate_card' ? 'card_balance' : 'balance';
            $this->increment($balanceField, $amount);

            return $this->transactions()->create([
                'tenant_id' => $this->tenant_id,
                'type' => TechnicianCashTransaction::TYPE_CREDIT,
                'payment_method' => $paymentMethod,
                'amount' => $amount,
                'balance_after' => $this->fresh()->$balanceField,
                'description' => $description,
                'transaction_date' => now()->toDateString(),
                'created_by' => $createdBy,
                'work_order_id' => $workOrderId,
            ]);
        });
    }

    /**
     * @throws ValidationException
     */
    public function addDebit(float $amount, string $description, ?int $expenseId = null, ?int $createdBy = null, ?int $workOrderId = null, bool $allowNegative = false, string $paymentMethod = 'cash'): TechnicianCashTransaction
    {
        return DB::transaction(function () use ($amount, $description, $expenseId, $createdBy, $workOrderId, $allowNegative, $paymentMethod) {
            $lockedFund = $this->lockForUpdate()->find($this->id);
            $balanceField = $paymentMethod === 'corporate_card' ? 'card_balance' : 'balance';
            $originalBalance = $lockedFund->$balanceField;

            if (!$allowNegative && (float) $originalBalance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ["Saldo insuficiente ({$paymentMethod}). Disponível: R$ {$originalBalance}"],
                ]);
            }

            $this->decrement($balanceField, $amount);

            return $this->transactions()->create([
                'tenant_id' => $this->tenant_id,
                'type' => TechnicianCashTransaction::TYPE_DEBIT,
                'payment_method' => $paymentMethod,
                'amount' => $amount,
                'balance_after' => $this->fresh()->$balanceField,
                'expense_id' => $expenseId,
                'description' => $description,
                'transaction_date' => now()->toDateString(),
                'created_by' => $createdBy,
                'work_order_id' => $workOrderId,
            ]);
        });
    }

    public static function getOrCreate(int $userId, int $tenantId): self
    {
        return static::firstOrCreate(
            ['user_id' => $userId, 'tenant_id' => $tenantId],
            ['balance' => 0, 'card_balance' => 0]
        );
    }
}
