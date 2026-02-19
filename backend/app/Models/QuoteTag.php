<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class QuoteTag extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'color',
    ];

    public function quotes(): BelongsToMany
    {
        return $this->belongsToMany(Quote::class, 'quote_quote_tag');
    }
}
