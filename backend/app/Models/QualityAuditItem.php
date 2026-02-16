<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QualityAuditItem extends Model
{
    protected $fillable = [
        'quality_audit_id', 'requirement', 'clause', 'question',
        'result', 'evidence', 'notes', 'item_order',
    ];

    public function audit(): BelongsTo { return $this->belongsTo(QualityAudit::class, 'quality_audit_id'); }
}
