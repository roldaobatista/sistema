<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class EmailTag extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'color',
    ];

    public function emails()
    {
        return $this->belongsToMany(Email::class, 'email_email_tag');
    }
}
