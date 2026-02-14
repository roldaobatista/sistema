<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserSkill extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'skill_id',
        'current_level',
        'assessed_at',
        'assessed_by',
    ];

    protected $casts = [
        'current_level' => 'integer',
        'assessed_at' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function skill()
    {
        return $this->belongsTo(Skill::class);
    }

    public function assessor()
    {
        return $this->belongsTo(User::class, 'assessed_by');
    }
}
