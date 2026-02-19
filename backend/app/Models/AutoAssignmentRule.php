<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AutoAssignmentRule extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'entity_type',
        'strategy',
        'conditions',
        'technician_ids',
        'required_skills',
        'priority',
        'is_active',
    ];

    protected $casts = [
        'conditions' => 'array',
        'technician_ids' => 'array',
        'required_skills' => 'array',
        'is_active' => 'boolean',
        'priority' => 'integer',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
