<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FuelingLog extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id', 'user_id', 'work_order_id', 'fueling_date',
        'vehicle_plate', 'odometer_km', 'gas_station_name',
        'gas_station_lat', 'gas_station_lng', 'fuel_type',
        'liters', 'price_per_liter', 'total_amount',
        'receipt_path', 'notes', 'status', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'fueling_date' => 'date',
            'odometer_km' => 'decimal:1',
            'gas_station_lat' => 'decimal:7',
            'gas_station_lng' => 'decimal:7',
            'liters' => 'decimal:2',
            'price_per_liter' => 'decimal:4',
            'total_amount' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_PENDING => ['label' => 'Pendente', 'color' => 'warning'],
        self::STATUS_APPROVED => ['label' => 'Aprovado', 'color' => 'success'],
        self::STATUS_REJECTED => ['label' => 'Rejeitado', 'color' => 'danger'],
    ];

    public const FUEL_TYPES = [
        'diesel' => 'Diesel',
        'diesel_s10' => 'Diesel S10',
        'gasolina' => 'Gasolina',
        'etanol' => 'Etanol',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
