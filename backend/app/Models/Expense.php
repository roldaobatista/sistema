<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Expense extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id',
        'expense_category_id',
        'work_order_id',
        'created_by',
        'approved_by',
        'chart_of_account_id',
        'description',
        'amount',
        'km_quantity',
        'km_rate',
        'km_billed_to_client',
        'expense_date',
        'payment_method',
        'notes',
        'receipt_path',
        'affects_technician_cash',
        'affects_net_value',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'km_quantity' => 'decimal:1',
            'km_rate' => 'decimal:4',
            'km_billed_to_client' => 'boolean',
            'expense_date' => 'date',
            'affects_technician_cash' => 'boolean',
            'affects_net_value' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    public const STATUS_PENDING = 'pending';
    public const STATUS_REVIEWED = 'reviewed';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_REIMBURSED = 'reimbursed';

    public const STATUSES = [
        self::STATUS_PENDING => ['label' => 'Pendente', 'color' => 'warning'],
        self::STATUS_REVIEWED => ['label' => 'Conferido', 'color' => 'info'],
        self::STATUS_APPROVED => ['label' => 'Aprovado', 'color' => 'success'],
        self::STATUS_REJECTED => ['label' => 'Rejeitado', 'color' => 'danger'],
        self::STATUS_REIMBURSED => ['label' => 'Reembolsado', 'color' => 'success'],
    ];

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'chart_of_account_id');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ExpenseStatusHistory::class)->orderByDesc('created_at');
    }
}
