<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;

class QualityProcedure extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'code', 'title', 'description', 'revision', 'category',
        'approved_by', 'approved_at', 'next_review_date', 'status', 'content',
    ];

    protected $casts = [
        'approved_at' => 'date',
        'next_review_date' => 'date',
        'revision' => 'integer',
    ];

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function correctiveActions(): HasMany
    {
        return $this->hasMany(CorrectiveAction::class, 'sourceable_id')
            ->where('sourceable_type', self::class);
    }
}
