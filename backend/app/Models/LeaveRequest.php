<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class LeaveRequest extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'type', 'start_date', 'end_date',
        'days_count', 'reason', 'document_path', 'status',
        'approved_by', 'approved_at', 'rejection_reason',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'days_count' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeOverlapping($query, int $userId, string $startDate, string $endDate)
    {
        return $query->where('user_id', $userId)
            ->where('status', '!=', 'cancelled')
            ->where('status', '!=', 'rejected')
            ->where('start_date', '<=', $endDate)
            ->where('end_date', '>=', $startDate);
    }

    public function getTypeLabel(): string
    {
        return match ($this->type) {
            'vacation' => 'Férias',
            'medical' => 'Atestado Médico',
            'personal' => 'Pessoal',
            'maternity' => 'Licença Maternidade',
            'paternity' => 'Licença Paternidade',
            'bereavement' => 'Luto',
            default => 'Outro',
        };
    }
}
