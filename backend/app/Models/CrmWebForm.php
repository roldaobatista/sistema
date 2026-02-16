<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmWebForm extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $table = 'crm_web_forms';

    protected $fillable = [
        'tenant_id', 'name', 'slug', 'description', 'fields',
        'pipeline_id', 'assign_to', 'sequence_id', 'redirect_url',
        'success_message', 'is_active', 'submissions_count',
    ];

    protected function casts(): array
    {
        return [
            'fields' => 'array',
            'is_active' => 'boolean',
            'submissions_count' => 'integer',
        ];
    }

    // ─── Scopes ─────────────────────────────────────────

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }

    // ─── Relationships ──────────────────────────────────

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(CrmPipeline::class, 'pipeline_id');
    }

    public function assignTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assign_to');
    }

    public function sequence(): BelongsTo
    {
        return $this->belongsTo(CrmSequence::class, 'sequence_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(CrmWebFormSubmission::class, 'form_id');
    }
}
