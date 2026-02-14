<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuvoImport extends Model
{
    use BelongsToTenant;

    protected $table = 'auvo_imports';

    // ─── Status Constants ───────────────────────────────────
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_DONE = 'done';
    public const STATUS_FAILED = 'failed';
    public const STATUS_ROLLED_BACK = 'rolled_back';

    public const STATUSES = [
        self::STATUS_PENDING => 'Pendente',
        self::STATUS_PROCESSING => 'Processando',
        self::STATUS_DONE => 'Concluído',
        self::STATUS_FAILED => 'Falhou',
        self::STATUS_ROLLED_BACK => 'Desfeita',
    ];

    // ─── Strategy Constants ─────────────────────────────────
    public const STRATEGY_SKIP = 'skip';
    public const STRATEGY_UPDATE = 'update';

    // ─── Entity Type Constants ──────────────────────────────
    public const ENTITY_CUSTOMERS = 'customers';
    public const ENTITY_EQUIPMENTS = 'equipments';
    public const ENTITY_EQUIPMENT_CATEGORIES = 'equipment_categories';
    public const ENTITY_PRODUCTS = 'products';
    public const ENTITY_PRODUCT_CATEGORIES = 'product_categories';
    public const ENTITY_SERVICES = 'services';
    public const ENTITY_TASKS = 'tasks';
    public const ENTITY_TASK_TYPES = 'task_types';
    public const ENTITY_EXPENSES = 'expenses';
    public const ENTITY_EXPENSE_TYPES = 'expense_types';
    public const ENTITY_QUOTATIONS = 'quotations';
    public const ENTITY_TICKETS = 'tickets';
    public const ENTITY_USERS = 'users';
    public const ENTITY_TEAMS = 'teams';
    public const ENTITY_SEGMENTS = 'segments';
    public const ENTITY_CUSTOMER_GROUPS = 'customer_groups';
    public const ENTITY_KEYWORDS = 'keywords';

    public const ENTITY_TYPES = [
        self::ENTITY_CUSTOMERS => 'Clientes',
        self::ENTITY_EQUIPMENTS => 'Equipamentos',
        self::ENTITY_EQUIPMENT_CATEGORIES => 'Categorias de Equipamento',
        self::ENTITY_PRODUCTS => 'Produtos',
        self::ENTITY_PRODUCT_CATEGORIES => 'Categorias de Produto',
        self::ENTITY_SERVICES => 'Serviços',
        self::ENTITY_TASKS => 'OS / Tasks',
        self::ENTITY_TASK_TYPES => 'Tipos de OS',
        self::ENTITY_EXPENSES => 'Despesas',
        self::ENTITY_EXPENSE_TYPES => 'Tipos de Despesa',
        self::ENTITY_QUOTATIONS => 'Orçamentos',
        self::ENTITY_TICKETS => 'Chamados',
        self::ENTITY_USERS => 'Usuários',
        self::ENTITY_TEAMS => 'Equipes',
        self::ENTITY_SEGMENTS => 'Segmentos',
        self::ENTITY_CUSTOMER_GROUPS => 'Grupos de Cliente',
        self::ENTITY_KEYWORDS => 'Palavras-chave',
    ];

    /**
     * Import order respecting dependencies.
     */
    public const IMPORT_ORDER = [
        self::ENTITY_SEGMENTS,
        self::ENTITY_CUSTOMER_GROUPS,
        self::ENTITY_KEYWORDS,
        self::ENTITY_CUSTOMERS,
        self::ENTITY_EQUIPMENT_CATEGORIES,
        self::ENTITY_EQUIPMENTS,
        self::ENTITY_PRODUCT_CATEGORIES,
        self::ENTITY_PRODUCTS,
        self::ENTITY_SERVICES,
        self::ENTITY_TASK_TYPES,
        self::ENTITY_EXPENSE_TYPES,
        self::ENTITY_USERS,
        self::ENTITY_TEAMS,
        self::ENTITY_QUOTATIONS,
        self::ENTITY_TASKS,
        self::ENTITY_EXPENSES,
        self::ENTITY_TICKETS,
    ];

    protected $fillable = [
        'tenant_id', 'user_id', 'entity_type', 'status',
        'total_fetched', 'inserted', 'updated', 'skipped', 'errors',
        'error_log', 'imported_ids', 'duplicate_strategy', 'filters',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'error_log' => 'array',
            'imported_ids' => 'array',
            'filters' => 'array',
            'total_fetched' => 'integer',
            'inserted' => 'integer',
            'updated' => 'integer',
            'skipped' => 'integer',
            'errors' => 'integer',
            'last_synced_at' => 'datetime',
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

    public function scopeByEntity($query, string $entity)
    {
        return $query->where('entity_type', $entity);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeLatestByEntity($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId)
            ->where('status', self::STATUS_DONE)
            ->orderByDesc('created_at');
    }
}
