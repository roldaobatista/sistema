<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo; // Existing imports preserved

class InmetroLeadInteraction extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'owner_id', 'user_id', 'tenant_id', 'channel', 'result',
        'notes', 'next_follow_up_at',
    ];

    protected function casts(): array
    {
        return [
            'next_follow_up_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(InmetroOwner::class, 'owner_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
