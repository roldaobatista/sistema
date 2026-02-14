<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContinuousFeedback extends Model
{
    use HasFactory, BelongsToTenant;

    protected $table = 'continuous_feedback';

    protected $fillable = [
        'tenant_id',
        'from_user_id',
        'to_user_id',
        'type',
        'content',
        'is_anonymous',
        'visibility',
    ];

    protected $casts = [
        'is_anonymous' => 'boolean',
    ];

    public function fromUser()
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }
}
