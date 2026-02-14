<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class RrStudy extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'title', 'instrument_id', 'parameter',
        'operators', 'repetitions', 'status',
        'results', 'conclusion', 'created_by',
    ];

    protected $casts = [
        'operators' => 'array',
        'repetitions' => 'integer',
        'results' => 'array',
    ];
}
