<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VisitRouteStop extends Model
{
    use HasFactory;

    protected $fillable = [
        'visit_route_id', 'customer_id', 'checkin_id', 'stop_order',
        'status', 'estimated_duration_minutes', 'objective', 'notes',
    ];

    const STATUSES = [
        'pending' => 'Pendente',
        'visited' => 'Visitado',
        'skipped' => 'Pulado',
    ];

    public function route(): BelongsTo { return $this->belongsTo(VisitRoute::class, 'visit_route_id'); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function checkin(): BelongsTo { return $this->belongsTo(VisitCheckin::class, 'checkin_id'); }
}
