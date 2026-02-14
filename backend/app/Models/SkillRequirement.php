<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SkillRequirement extends Model
{
    use HasFactory;

    protected $fillable = [
        'position_id',
        'skill_id',
        'required_level',
    ];

    protected $casts = [
        'required_level' => 'integer',
    ];

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function skill()
    {
        return $this->belongsTo(Skill::class);
    }
}
