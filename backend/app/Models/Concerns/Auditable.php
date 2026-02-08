<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;

/**
 * Registra automaticamente created/updated/deleted no AuditLog.
 * Use: `use Auditable;` no model.
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function ($model) {
            self::logAudit('created', $model, null, $model->getAttributes());
        });

        static::updated(function ($model) {
            $dirty = $model->getDirty();
            if (empty($dirty)) return;

            $old = array_intersect_key($model->getOriginal(), $dirty);
            self::logAudit('updated', $model, $old, $dirty);
        });

        static::deleted(function ($model) {
            self::logAudit('deleted', $model, $model->getOriginal(), null);
        });
    }

    protected static function logAudit(string $action, $model, ?array $old, ?array $new): void
    {
        // Evita loops — não audita o próprio AuditLog
        if ($model instanceof AuditLog) return;

        // Filtra campos sensíveis
        $hidden = $model->getHidden();
        if ($old) $old = array_diff_key($old, array_flip($hidden));
        if ($new) $new = array_diff_key($new, array_flip($hidden));

        $labels = [
            'created' => 'Registro criado',
            'updated' => 'Registro atualizado',
            'deleted' => 'Registro excluído',
        ];

        try {
            AuditLog::log(
                $action,
                $labels[$action] . ': ' . class_basename($model) . " #{$model->getKey()}",
                $model,
                $old,
                $new
            );
        } catch (\Throwable) {
            // Silencia para não bloquear operações em ambientes sem tabela audit_logs
        }
    }
}
