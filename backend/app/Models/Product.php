<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use App\Models\Batch;
use App\Models\WarehouseStock;
use App\Models\ProductSerial;
use App\Models\ProductKit;

class Product extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'code',
        'name',
        'description',
        'unit',
        'cost_price',
        'sell_price',
        'stock_qty',
        'stock_min',
        'is_active',
        'track_stock',
        'is_kit',
        'track_batch',
        'track_serial',
        'min_repo_point',
        'manufacturer_code',
        'storage_location',
    ];

    protected function casts(): array
    {
        return [
            'cost_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'stock_qty' => 'decimal:2',
            'stock_min' => 'decimal:2',
            'track_stock' => 'boolean',
            'is_active' => 'boolean',
            'is_kit' => 'boolean',
            'track_batch' => 'boolean',
            'track_serial' => 'boolean',
            'min_repo_point' => 'decimal:2',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function warehouseStocks(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }

    public function serials(): HasMany
    {
        return $this->hasMany(ProductSerial::class);
    }

    public function kitItems(): HasMany
    {
        return $this->hasMany(ProductKit::class, 'parent_id');
    }

    public function isChildOf(): HasMany
    {
        return $this->hasMany(ProductKit::class, 'child_id');
    }

    public function equipmentModels(): BelongsToMany
    {
        return $this->belongsToMany(EquipmentModel::class, 'equipment_model_product');
    }

    public function priceHistories()
    {
        return $this->morphMany(PriceHistory::class, 'priceable');
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->where('stock_min', '>', 0)
            ->whereColumn('stock_qty', '<=', 'stock_min');
    }

    /** Margem de lucro em % */
    public function getProfitMarginAttribute(): ?float
    {
        if (!$this->sell_price || $this->sell_price == 0) return null;
        if (!$this->cost_price || $this->cost_price == 0) return 100.0;
        return round((($this->sell_price - $this->cost_price) / $this->sell_price) * 100, 2);
    }

    public function getMarkupAttribute(): ?float
    {
        if (!$this->cost_price || $this->cost_price == 0) return null;
        return round($this->sell_price / $this->cost_price, 2);
    }

    // ─── Import Support ─────────────────────────────────────

    public static function getImportFields(): array
    {
        return [
            ['key' => 'code', 'label' => 'Código', 'required' => true],
            ['key' => 'name', 'label' => 'Nome', 'required' => true],
            ['key' => 'sell_price', 'label' => 'Preço Venda', 'required' => true],
            ['key' => 'category_name', 'label' => 'Categoria', 'required' => false],
            ['key' => 'description', 'label' => 'Descrição', 'required' => false],
            ['key' => 'unit', 'label' => 'Unidade', 'required' => false],
            ['key' => 'cost_price', 'label' => 'Preço Custo', 'required' => false],
            ['key' => 'stock_qty', 'label' => 'Estoque Atual', 'required' => false],
            ['key' => 'stock_min', 'label' => 'Estoque Mínimo', 'required' => false],
        ];
    }
}
