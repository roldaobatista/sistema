<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\Auditable;

class CrmSequence extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $table = 'crm_sequences';

    protected $fillable = [
        'tenant_id', 'name', 'description',
        'status', 'total_steps', 'created_by',
    ];

    public const STATUSES = [
        'active' => 'Ativa',
        'paused' => 'Pausada',
        'archived' => 'Arquivada',
    ];

    // ─── Scopes ─────────────────────────────────────────

    public function scopeActive($q)
    {
        return $q->where('status', 'active');
    }

    // ─── Relationships ──────────────────────────────────

    public function steps(): HasMany
    {
        return $this->hasMany(CrmSequenceStep::class, 'sequence_id')->orderBy('step_order');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(CrmSequenceEnrollment::class, 'sequence_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
