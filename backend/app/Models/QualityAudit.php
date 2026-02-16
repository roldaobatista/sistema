<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QualityAudit extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'audit_number', 'title', 'type', 'scope',
        'planned_date', 'executed_date', 'auditor_id', 'status',
        'summary', 'non_conformities_found', 'observations_found',
    ];

    protected function casts(): array
    {
        return [
            'planned_date' => 'date',
            'executed_date' => 'date',
        ];
    }

    public function auditor(): BelongsTo { return $this->belongsTo(User::class, 'auditor_id'); }
    public function items(): HasMany { return $this->hasMany(QualityAuditItem::class); }
}
