<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PerformanceReview extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'reviewer_id',
        'title',
        'cycle',
        'year',
        'type',
        'status',
        'ratings',
        'okrs',
        'nine_box_potential',
        'nine_box_performance',
        'action_plan',
        'comments',
    ];

    protected $casts = [
        'ratings' => 'array',
        'okrs' => 'array',
        'year' => 'integer',
        'nine_box_potential' => 'integer',
        'nine_box_performance' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
