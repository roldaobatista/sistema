<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class EmailSignature extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'email_account_id',
        'name',
        'html_content',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function account()
    {
        return $this->belongsTo(EmailAccount::class, 'email_account_id');
    }
}
