<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CentralRule extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'nome', 'descricao', 'ativo',
        'evento_trigger', 'tipo_item', 'status_trigger', 'prioridade_minima',
        'acao_tipo', 'acao_config',
        'responsavel_user_id', 'role_alvo',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'ativo' => 'boolean',
            'acao_config' => 'array',
        ];
    }

    public function responsavel(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsavel_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ── Scopes ──

    public function scopeAtivas($query)
    {
        return $query->where('ativo', true);
    }

    public function scopeParaEvento($query, string $evento)
    {
        return $query->where('evento_trigger', $evento);
    }
}
