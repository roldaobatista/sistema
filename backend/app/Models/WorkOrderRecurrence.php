<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkOrderRecurrence extends Model
{
    use HasFactory, BelongsToTenant, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'customer_id',
        'service_id',
        'name',
        'description',
        'frequency',
        'interval',
        'day_of_month',
        'day_of_week',
        'start_date',
        'end_date',
        'last_generated_at',
        'next_generation_date',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'next_generation_date' => 'date',
        'last_generated_at' => 'datetime',
        'is_active' => 'boolean',
        'metadata' => 'array',
        'day_of_month' => 'integer',
        'day_of_week' => 'integer',
        'interval' => 'integer',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}
