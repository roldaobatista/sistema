<?php

namespace App\Services\Auvo;

/**
 * Static field mappings: Auvo API field names → Kalibrium model field names.
 *
 * Each entity has a MAP constant and a required() method for validation.
 */
class AuvoFieldMapper
{
    // ─── Customers ──────────────────────────────────────────
    // Auvo V2: id, description (=name), cpfCnpj, phoneNumber (array), email (array), active
    public const CUSTOMER_MAP = [
        'id'              => '_auvo_id',
        'description'     => 'name',
        'cpfCnpj'         => 'document',
        'email'           => 'email',        // array in Auvo — first element used
        'phoneNumber'     => 'phone',        // array in Auvo — first element used
        'address'         => 'address_street',
        'number'          => 'address_number',
        'complement'      => 'address_complement',
        'neighborhood'    => 'address_neighborhood',
        'city'            => 'address_city',
        'state'           => 'address_state',
        'zipCode'         => 'address_zip',
        'notes'           => 'notes',
        'externalId'      => '_external_id',
        'active'          => 'is_active',
    ];

    // ─── Equipments ─────────────────────────────────────────
    // Auvo V2: id, name, identifier, associatedCustomerId, equipmentSpecifications
    public const EQUIPMENT_MAP = [
        'id'                    => '_auvo_id',
        'identifier'            => 'serial_number',
        'name'                  => 'name',
        'categoryId'            => '_category_auvo_id',
        'categoryName'          => '_category_name',
        'associatedCustomerId'  => '_customer_auvo_id',
        'brand'                 => 'brand',
        'model'                 => 'model',
        'notes'                 => 'notes',
        'externalId'            => '_external_id',
    ];

    // ─── Products ───────────────────────────────────────────
    // Auvo V2: id, name, code, description, price, costPrice
    public const PRODUCT_MAP = [
        'id'            => '_auvo_id',
        'name'          => 'name',
        'code'          => 'code',
        'description'   => 'description',
        'price'         => 'sell_price',
        'costPrice'     => 'cost_price',
        'categoryId'    => '_category_auvo_id',
        'categoryName'  => '_category_name',
        'unit'          => 'unit',
        'stockQty'      => 'stock_qty',
        'stockMin'      => 'stock_min',
    ];

    // ─── Services ───────────────────────────────────────────
    // Auvo V2: id, name, code, description, price
    public const SERVICE_MAP = [
        'id'            => '_auvo_id',
        'name'          => 'name',
        'code'          => 'code',
        'description'   => 'description',
        'price'         => 'default_price',
    ];

    // ─── Tasks (OS / Work Orders) ───────────────────────────
    // Auvo V2: taskID (uppercase D!), title, customerId, taskStatus (1-6 numeric)
    public const TASK_MAP = [
        'taskID'            => '_auvo_id',     // NB: uppercase D in Auvo V2
        'title'             => 'title',
        'description'       => 'description',
        'customerId'        => '_customer_auvo_id',
        'customerDescription' => '_customer_name',
        'idUserTo'          => '_technician_auvo_id',
        'userToName'        => '_technician_name',
        'taskTypeId'        => '_task_type_auvo_id',
        'taskTypeName'      => '_task_type_name',
        'taskStatus'        => 'status',       // numeric: 1=Open,2=InTransit,3=CheckIn,4=CheckOut,5=Finished,6=Paused
        'priority'          => 'priority',
        'startDate'         => 'scheduled_start',
        'endDate'           => 'scheduled_end',
        'completedDate'     => 'completed_at',
        'address'           => 'address',
        'latitude'          => 'latitude',
        'longitude'         => 'longitude',
        'notes'             => 'notes',
        'externalId'        => '_external_id',
    ];

    // ─── Expenses ───────────────────────────────────────────
    // Auvo V2: id, description, value, date, userId, taskId
    public const EXPENSE_MAP = [
        'id'                => '_auvo_id',
        'description'       => 'description',
        'value'             => 'amount',
        'date'              => 'expense_date',
        'userId'            => '_user_auvo_id',
        'taskId'            => '_task_auvo_id',
        'expenseTypeId'     => '_type_auvo_id',
        'expenseTypeName'   => '_type_name',
    ];

    // ─── Quotations (Orçamentos) ────────────────────────────
    // Auvo V2: id, title, customerId, status, totalValue, validUntil
    public const QUOTATION_MAP = [
        'id'                => '_auvo_id',
        'title'             => 'title',
        'customerId'        => '_customer_auvo_id',
        'status'            => 'status',
        'totalValue'        => 'total',
        'validUntil'        => 'valid_until',
        'notes'             => 'notes',
    ];

    // ─── Users ──────────────────────────────────────────────
    // Auvo V2: id, name, email, phone, userType
    public const USER_MAP = [
        'id'                => '_auvo_id',
        'name'              => 'name',
        'email'             => 'email',
        'phone'             => 'phone',
        'userType'          => '_user_type',
        'externalId'        => '_external_id',
    ];

    // ─── Teams ──────────────────────────────────────────────
    // Auvo V2: id, name, description
    public const TEAM_MAP = [
        'id'                => '_auvo_id',
        'name'              => 'name',
        'description'       => 'description',
    ];

    /**
     * Map a raw Auvo record to Kalibrium fields using the given mapping.
     *
     * Fields prefixed with _ are metadata (auvo IDs, references) not directly persisted.
     */
    public static function map(array $auvoRecord, array $fieldMap): array
    {
        $mapped = [];

        foreach ($fieldMap as $auvoField => $localField) {
            if (array_key_exists($auvoField, $auvoRecord)) {
                $mapped[$localField] = $auvoRecord[$auvoField];
            }
        }

        return $mapped;
    }

    /**
     * Get the field mapping for an entity type.
     */
    public static function getMap(string $entityType): array
    {
        return match ($entityType) {
            'customers'     => self::CUSTOMER_MAP,
            'equipments'    => self::EQUIPMENT_MAP,
            'products'      => self::PRODUCT_MAP,
            'services'      => self::SERVICE_MAP,
            'tasks'         => self::TASK_MAP,
            'expenses'      => self::EXPENSE_MAP,
            'quotations'    => self::QUOTATION_MAP,
            'users'         => self::USER_MAP,
            'teams'         => self::TEAM_MAP,
            default         => [],
        };
    }

    /**
     * Get Auvo API endpoint for an entity type.
     */
    public static function getEndpoint(string $entityType): string
    {
        return match ($entityType) {
            'customers'             => 'customers',
            'customer_groups'       => 'customerGroups',
            'equipments'            => 'equipments',
            'equipment_categories'  => 'equipmentCategories',
            'products'              => 'products',
            'product_categories'    => 'productCategories',
            'services'              => 'services',
            'tasks'                 => 'tasks',
            'task_types'            => 'taskTypes',
            'expenses'              => 'expenses',
            'expense_types'         => 'expenseTypes',
            'quotations'            => 'quotations',
            'tickets'               => 'tickets',
            'users'                 => 'users',
            'teams'                 => 'teams',
            'segments'              => 'segments',
            'keywords'              => 'keywords',
            default                 => $entityType,
        };
    }

    /**
     * Extract the Auvo ID from a mapped record.
     */
    public static function extractAuvoId(array $mapped): ?int
    {
        $id = $mapped['_auvo_id'] ?? null;
        return $id !== null ? (int) $id : null;
    }

    /**
     * Remove metadata fields (prefixed with _) leaving only persistable fields.
     */
    public static function stripMetadata(array $mapped): array
    {
        return array_filter($mapped, function ($key) {
            return !str_starts_with($key, '_');
        }, ARRAY_FILTER_USE_KEY);
    }
    /**
     * Check if the entity type is valid and supported.
     */
    public static function isValidEntity(string $entity): bool
    {
        return in_array($entity, [
            'customers', 'customer_groups', 'equipments', 'equipment_categories',
            'products', 'product_categories', 'services', 'tasks', 'task_types',
            'expenses', 'expense_types', 'quotations', 'tickets', 'users', 'teams',
            'segments', 'keywords'
        ]);
    }
}
