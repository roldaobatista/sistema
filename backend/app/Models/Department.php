<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'parent_id',
        'manager_id',
        'cost_center',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function parent()
    {
        return $this->belongsTo(Department::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Department::class, 'parent_id');
    }

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function positions()
    {
        return $this->hasMany(Position::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
