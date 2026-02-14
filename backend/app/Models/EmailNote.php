<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class EmailNote extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'email_id',
        'user_id',
        'content',
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
