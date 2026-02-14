<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Service extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable, HasFactory;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'code',
        'name',
        'description',
        'default_price',
        'estimated_minutes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'default_price' => 'decimal:2',
            'estimated_minutes' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'category_id');
    }

    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'service_skills')
            ->withPivot('required_level')
            ->withTimestamps();
    }

    // ─── Import Support ─────────────────────────────────────

    public static function getImportFields(): array
    {
        return [
            ['key' => 'code', 'label' => 'Código', 'required' => true],
            ['key' => 'name', 'label' => 'Nome', 'required' => true],
            ['key' => 'default_price', 'label' => 'Preço', 'required' => true],
            ['key' => 'category_name', 'label' => 'Categoria', 'required' => false],
            ['key' => 'description', 'label' => 'Descrição', 'required' => false],
            ['key' => 'estimated_minutes', 'label' => 'Tempo Estimado (min)', 'required' => false],
        ];
    }
}
