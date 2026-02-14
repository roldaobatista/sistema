<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InmetroProspectionQueue extends Model
{
    use HasFactory, BelongsToTenant;

    protected $table = 'inmetro_prospection_queue';

    protected $fillable = [
        'owner_id', 'tenant_id', 'assigned_to', 'queue_date', 'position',
        'reason', 'suggested_script', 'status', 'contacted_at',
    ];

    protected function casts(): array
    {
        return [
            'queue_date' => 'date',
            'contacted_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(InmetroOwner::class, 'owner_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function scopeForDate($query, $date = null)
    {
        return $query->where('queue_date', $date ?? today());
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }
}
