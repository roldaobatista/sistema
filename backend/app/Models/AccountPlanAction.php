<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountPlanAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'account_plan_id', 'assigned_to', 'title', 'description',
        'due_date', 'status', 'sort_order', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    const STATUSES = [
        'pending' => 'Pendente',
        'in_progress' => 'Em Andamento',
        'completed' => 'Concluído',
        'cancelled' => 'Cancelado',
    ];

    public function plan(): BelongsTo { return $this->belongsTo(AccountPlan::class, 'account_plan_id'); }
    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
}
