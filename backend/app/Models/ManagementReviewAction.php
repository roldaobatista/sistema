<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManagementReviewAction extends Model
{
    protected $table = 'management_review_actions';

    protected $fillable = [
        'management_review_id', 'description', 'responsible_id',
        'due_date', 'status', 'completed_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'completed_at' => 'date',
        ];
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(ManagementReview::class, 'management_review_id');
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }
}
