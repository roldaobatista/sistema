<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Checklist extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'description',
        'items',
        'is_active',
    ];

    protected $casts = [
        'items' => 'array',
        'is_active' => 'boolean',
    ];

    public function submissions()
    {
        return $this->hasMany(ChecklistSubmission::class);
    }
}
