<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EquipmentModel extends Model
{
    use BelongsToTenant;

    protected $table = 'equipment_models';

    protected $fillable = [
        'tenant_id',
        'name',
        'brand',
        'category',
    ];

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'equipment_model_product');
    }

    public function equipments(): HasMany
    {
        return $this->hasMany(Equipment::class, 'equipment_model_id');
    }
}
