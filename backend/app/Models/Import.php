<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Import extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'entity_type', 'file_name',
        'total_rows', 'inserted', 'updated', 'skipped', 'errors',
        'status', 'mapping', 'error_log', 'duplicate_strategy',
    ];

    protected function casts(): array
    {
        return [
            'mapping' => 'array',
            'error_log' => 'array',
            'total_rows' => 'integer',
            'inserted' => 'integer',
            'updated' => 'integer',
            'skipped' => 'integer',
            'errors' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
