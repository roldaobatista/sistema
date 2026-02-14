<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class EmailActivity extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'email_id',
        'user_id',
        'type',
        'details',
    ];

    protected $casts = [
        'details' => 'array',
    ];

    public function email()
    {
        return $this->belongsTo(Email::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
