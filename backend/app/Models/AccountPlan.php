<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountPlan extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'owner_id', 'title', 'objective',
        'status', 'start_date', 'target_date', 'revenue_target',
        'revenue_current', 'progress_percent', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'target_date' => 'date',
            'revenue_target' => 'decimal:2',
            'revenue_current' => 'decimal:2',
        ];
    }

    const STATUSES = [
        'active' => 'Ativo',
        'completed' => 'Concluído',
        'paused' => 'Pausado',
        'cancelled' => 'Cancelado',
    ];

    public function scopeActive($q) { return $q->where('status', 'active'); }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function actions(): HasMany { return $this->hasMany(AccountPlanAction::class)->orderBy('sort_order'); }

    public function recalculateProgress(): void
    {
        $total = $this->actions()->count();
        $completed = $this->actions()->where('status', 'completed')->count();
        $this->update(['progress_percent' => $total > 0 ? round(($completed / $total) * 100) : 0]);
    }
}
