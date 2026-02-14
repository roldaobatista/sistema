<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class EmailTemplate extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'name',
        'subject',
        'body',
        'is_shared',
    ];

    protected $casts = [
        'is_shared' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
