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

    protected $fillable = ['tenant_id', 'user_id', 'balance'];

    protected function casts(): array
    {
        return ['balance' => 'decimal:2'];
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(TechnicianCashTransaction::class, 'fund_id')->orderByDesc('transaction_date')->orderByDesc('id');
    }

    public function addCredit(float $amount, string $description, ?int $createdBy = null, ?int $workOrderId = null): TechnicianCashTransaction
    {
        return DB::transaction(function () use ($amount, $description, $createdBy, $workOrderId) {
            // Lock the row for update to prevent race conditions
            $lockedFund = self::lockForUpdate()->findOrFail($this->id);

            $this->increment('balance', $amount);

            return $this->transactions()->create([
                'tenant_id' => $this->tenant_id,
                'type' => TechnicianCashTransaction::TYPE_CREDIT,
                'amount' => $amount,
                'balance_after' => $this->fresh()->balance,
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
    public function addDebit(float $amount, string $description, ?int $expenseId = null, ?int $createdBy = null, ?int $workOrderId = null, bool $allowNegative = false): TechnicianCashTransaction
    {
        return DB::transaction(function () use ($amount, $description, $expenseId, $createdBy, $workOrderId, $allowNegative) {
            // Lock the row for update to prevent race conditions
            $originalBalance = $this->lockForUpdate()->find($this->id)->balance;

            if (!$allowNegative && (float) $originalBalance < $amount) {
                throw ValidationException::withMessages([
                    'amount' => ["Saldo insuficiente. Disponivel: R$ {$originalBalance}"],
                ]);
            }

            $this->decrement('balance', $amount);

            return $this->transactions()->create([
                'tenant_id' => $this->tenant_id,
                'type' => TechnicianCashTransaction::TYPE_DEBIT,
                'amount' => $amount,
                'balance_after' => $this->fresh()->balance,
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
            ['balance' => 0]
        );
    }
}
