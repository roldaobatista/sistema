<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class EquipmentDocument extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'equipment_id', 'type', 'name', 'file_path',
        'expires_at', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return ['expires_at' => 'date'];
    }

    public function equipment(): BelongsTo { return $this->belongsTo(Equipment::class); }
    public function uploader(): BelongsTo { return $this->belongsTo(User::class, 'uploaded_by'); }
}
