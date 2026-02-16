<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Commitment extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'user_id', 'visit_report_id',
        'activity_id', 'title', 'description', 'responsible_type',
        'responsible_name', 'due_date', 'status', 'completed_at',
        'completion_notes', 'priority',
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
        'completed' => 'Cumprido',
        'overdue' => 'Atrasado',
        'cancelled' => 'Cancelado',
    ];

    const RESPONSIBLE_TYPES = [
        'us' => 'Nossa Empresa',
        'client' => 'Cliente',
        'both' => 'Ambos',
    ];

    const PRIORITIES = [
        'low' => 'Baixa',
        'normal' => 'Normal',
        'high' => 'Alta',
        'urgent' => 'Urgente',
    ];

    public function scopePending($q) { return $q->where('status', 'pending'); }
    public function scopeOverdue($q) { return $q->where('status', 'pending')->where('due_date', '<', today()); }
    public function scopeByCustomer($q, int $id) { return $q->where('customer_id', $id); }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function visitReport(): BelongsTo { return $this->belongsTo(VisitReport::class); }
    public function activity(): BelongsTo { return $this->belongsTo(CrmActivity::class, 'activity_id'); }

    public function markCompleted(string $notes = null): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
            'completion_notes' => $notes,
        ]);
    }
}
