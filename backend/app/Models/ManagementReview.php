<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ManagementReview extends Model
{
    use BelongsToTenant;

    protected $table = 'management_reviews';

    protected $fillable = [
        'tenant_id', 'meeting_date', 'title', 'participants', 'agenda',
        'decisions', 'summary', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'meeting_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(ManagementReviewAction::class);
    }
}
