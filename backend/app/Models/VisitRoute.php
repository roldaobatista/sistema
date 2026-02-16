<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VisitRoute extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'user_id', 'route_date', 'name', 'status',
        'total_stops', 'completed_stops', 'total_distance_km',
        'estimated_duration_minutes', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'route_date' => 'date',
            'total_distance_km' => 'float',
        ];
    }

    const STATUSES = [
        'planned' => 'Planejado',
        'in_progress' => 'Em Andamento',
        'completed' => 'Concluído',
        'cancelled' => 'Cancelado',
    ];

    public function scopePlanned($q) { return $q->where('status', 'planned'); }
    public function scopeToday($q) { return $q->whereDate('route_date', today()); }
    public function scopeByUser($q, int $userId) { return $q->where('user_id', $userId); }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function stops(): HasMany { return $this->hasMany(VisitRouteStop::class)->orderBy('stop_order'); }
}
