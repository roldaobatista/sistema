<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceChecklist extends Model
{
    use BelongsToTenant, Auditable;

    protected $fillable = [
        'tenant_id', 'name', 'description', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(ServiceChecklistItem::class, 'checklist_id')->orderBy('order_index');
    }
}
