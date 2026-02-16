<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SearchIndex extends Model
{
    use BelongsToTenant;

    protected $table = 'search_index';

    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'searchable_type', 'searchable_id',
        'title', 'content', 'module', 'url', 'indexed_at',
    ];

    protected function casts(): array
    {
        return [
            'indexed_at' => 'datetime',
        ];
    }

    public function searchable(): MorphTo
    {
        return $this->morphTo();
    }

    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->whereRaw(
            'MATCH(title, content) AGAINST(? IN BOOLEAN MODE)',
            [$term]
        );
    }
}
