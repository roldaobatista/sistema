<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Import extends Model
{
    use BelongsToTenant, HasFactory;

    // ─── Status Constants ───────────────────────────────────
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_DONE = 'done';
    public const STATUS_FAILED = 'failed';
    public const STATUS_ROLLED_BACK = 'rolled_back';
    public const STATUS_PARTIALLY_ROLLED_BACK = 'partially_rolled_back';

    public const STATUSES = [
        self::STATUS_PENDING => 'Pendente',
        self::STATUS_PROCESSING => 'Processando',
        self::STATUS_DONE => 'Concluído',
        self::STATUS_FAILED => 'Falhou',
        self::STATUS_ROLLED_BACK => 'Desfeita',
        self::STATUS_PARTIALLY_ROLLED_BACK => 'Parcialmente Desfeita',
    ];

    // ─── Duplicate Strategy Constants ───────────────────────
    public const STRATEGY_SKIP = 'skip';
    public const STRATEGY_UPDATE = 'update';
    public const STRATEGY_CREATE = 'create';

    public const STRATEGIES = [
        self::STRATEGY_SKIP => 'Pular duplicatas',
        self::STRATEGY_UPDATE => 'Atualizar existentes',
        self::STRATEGY_CREATE => 'Criar novo',
    ];

    // ─── Entity Type Constants ──────────────────────────────
    public const ENTITY_CUSTOMERS = 'customers';
    public const ENTITY_PRODUCTS = 'products';
    public const ENTITY_SERVICES = 'services';
    public const ENTITY_EQUIPMENTS = 'equipments';
    public const ENTITY_SUPPLIERS = 'suppliers';

    public const ENTITY_TYPES = [
        self::ENTITY_CUSTOMERS => 'Clientes',
        self::ENTITY_PRODUCTS => 'Produtos',
        self::ENTITY_SERVICES => 'Serviços',
        self::ENTITY_EQUIPMENTS => 'Equipamentos',
        self::ENTITY_SUPPLIERS => 'Fornecedores',
    ];

    // ─── Limits ─────────────────────────────────────────────
    public const MAX_ROWS_LIMIT = 10000;

    protected $fillable = [
        'tenant_id', 'user_id', 'entity_type', 'file_name', 'original_name',
        'separator', 'total_rows', 'inserted', 'updated', 'skipped', 'errors',
        'status', 'mapping', 'error_log', 'duplicate_strategy', 'imported_ids',
        'progress',
    ];

    protected function casts(): array
    {
        return [
            'mapping' => 'array',
            'error_log' => 'array',
            'imported_ids' => 'array',
            'total_rows' => 'integer',
            'inserted' => 'integer',
            'updated' => 'integer',
            'skipped' => 'integer',
            'errors' => 'integer',
            'progress' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByEntity($query, string $entity)
    {
        return $query->where('entity_type', $entity);
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('file_name', 'like', "%{$term}%")
              ->orWhere('original_name', 'like', "%{$term}%");
        });
    }
}
