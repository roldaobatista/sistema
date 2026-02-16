<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TechnicianSkill extends Model
{
    use BelongsToTenant, Auditable;

    protected $table = 'technician_skills';

    protected $fillable = [
        'tenant_id', 'user_id', 'skill_name', 'category',
        'proficiency_level', 'certification', 'certified_at', 'expires_at',
    ];

    public const CATEGORIES = [
        'equipment_type' => 'Tipo de Equipamento',
        'service_type' => 'Tipo de Serviço',
        'brand' => 'Marca',
        'certification' => 'Certificação',
        'general' => 'Geral',
    ];

    public const LEVELS = [
        1 => 'Básico',
        2 => 'Intermediário',
        3 => 'Avançado',
        4 => 'Especialista',
        5 => 'Master',
    ];

    protected function casts(): array
    {
        return [
            'proficiency_level' => 'integer',
            'certified_at' => 'date',
            'expires_at' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
