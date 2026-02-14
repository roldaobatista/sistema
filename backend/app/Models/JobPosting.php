<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobPosting extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'title',
        'department_id',
        'position_id',
        'description',
        'requirements',
        'salary_range_min',
        'salary_range_max',
        'status',
        'opened_at',
        'closed_at',
    ];

    protected $casts = [
        'salary_range_min' => 'decimal:2',
        'salary_range_max' => 'decimal:2',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
