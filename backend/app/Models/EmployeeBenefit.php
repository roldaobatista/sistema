<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BelongsToTenant;

class EmployeeBenefit extends Model
{
    use HasFactory, HasUuids, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'type',
        'provider',
        'value',
        'employee_contribution',
        'start_date',
        'end_date',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'employee_contribution' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
