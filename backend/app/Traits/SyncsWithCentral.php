<?php

namespace App\Traits;

use App\Models\CentralItem;

/**
 * Trait para modelos que devem sincronizar status com CentralItem.
 *
 * Quando um model de origem (OS, Chamado, etc.) é atualizado,
 * o CentralItem correspondente é atualizado automaticamente.
 *
 * Usage: use SyncsWithCentral; em WorkOrder, ServiceCall, Quote, etc.
 */
trait SyncsWithCentral
{
    protected static function bootSyncsWithCentral(): void
    {
        static::updated(function ($model) {
            // Só sincroniza se o model tem tenant_id
            if (!$model->tenant_id) {
                return;
            }

            $overrides = $model->centralSyncData();
            if (!empty($overrides)) {
                CentralItem::syncFromSource($model, $overrides);
            }
        });
    }

    /**
     * Retorna os dados que devem ser sincronizados no CentralItem.
     * Override este método nos models que usam a trait.
     *
     * @return array Ex: ['status' => CentralItemStatus::CONCLUIDO, 'titulo' => 'OS #123 - Concluída']
     */
    public function centralSyncData(): array
    {
        return [];
    }
}
