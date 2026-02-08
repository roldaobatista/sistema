<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ImportTemplate extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'entity_type', 'name', 'mapping',
    ];

    protected function casts(): array
    {
        return ['mapping' => 'array'];
    }
}
