<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class SatisfactionSurvey extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'customer_id', 'work_order_id', 'nps_score',
        'service_rating', 'technician_rating', 'timeliness_rating',
        'comment', 'channel',
    ];

    protected $casts = [
        'nps_score' => 'integer',
        'service_rating' => 'integer',
        'technician_rating' => 'integer',
        'timeliness_rating' => 'integer',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function getNpsCategoryAttribute(): string
    {
        if ($this->nps_score >= 9) return 'promoter';
        if ($this->nps_score >= 7) return 'passive';
        return 'detractor';
    }
}
