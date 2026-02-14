<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class AuvoIdMapping extends Model
{
    use BelongsToTenant;

    protected $table = 'auvo_id_mappings';

    protected $fillable = [
        'tenant_id', 'entity_type', 'auvo_id', 'local_id',
    ];

    protected function casts(): array
    {
        return [
            'auvo_id' => 'integer',
            'local_id' => 'integer',
        ];
    }

    /**
     * Find local Kalibrium ID by Auvo ID.
     */
    public static function findLocal(string $entity, int $auvoId, int $tenantId): ?int
    {
        $mapping = static::where('tenant_id', $tenantId)
            ->where('entity_type', $entity)
            ->where('auvo_id', $auvoId)
            ->first();

        return $mapping?->local_id;
    }

    /**
     * Find Auvo ID by local Kalibrium ID.
     */
    public static function findAuvo(string $entity, int $localId, int $tenantId): ?int
    {
        $mapping = static::where('tenant_id', $tenantId)
            ->where('entity_type', $entity)
            ->where('local_id', $localId)
            ->first();

        return $mapping?->auvo_id;
    }

    /**
     * Create or update a mapping entry.
     */
    public static function mapOrCreate(string $entity, int $auvoId, ?int $localId, int $tenantId): self
    {
        return static::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'entity_type' => $entity,
                'auvo_id' => $auvoId,
            ],
            [
                'local_id' => $localId,
            ]
        );
    }

    /**
     * Check if an Auvo ID is already mapped.
     */
    public static function isMapped(string $entity, int $auvoId, int $tenantId): bool
    {
        return static::where('tenant_id', $tenantId)
            ->where('entity_type', $entity)
            ->where('auvo_id', $auvoId)
            ->exists();
    }

    /**
     * Get all mappings for an entity type.
     */
    public static function getMappings(string $entity, int $tenantId): array
    {
        return static::where('tenant_id', $tenantId)
            ->where('entity_type', $entity)
            ->pluck('local_id', 'auvo_id')
            ->toArray();
    }

    /**
     * Delete all mappings for specific local IDs (used in rollback).
     */
    public static function deleteMappingsForLocalIds(string $entity, array $localIds, int $tenantId): int
    {
        return static::where('tenant_id', $tenantId)
            ->where('entity_type', $entity)
            ->whereIn('local_id', $localIds)
            ->delete();
    }
}
