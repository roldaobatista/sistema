<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExcentricityTest extends Model
{
    use BelongsToTenant;

    public const POSITIONS = [
        'center' => 'Centro',
        'front_left' => 'Frente Esquerda',
        'front_right' => 'Frente Direita',
        'rear_left' => 'Traseira Esquerda',
        'rear_right' => 'Traseira Direita',
        'left_center' => 'Centro Esquerda',
        'right_center' => 'Centro Direita',
    ];

    protected $fillable = [
        'tenant_id', 'equipment_calibration_id', 'position',
        'load_applied', 'indication', 'error', 'max_permissible_error',
        'conforms', 'position_order',
    ];

    protected function casts(): array
    {
        return [
            'load_applied' => 'decimal:4',
            'indication' => 'decimal:4',
            'error' => 'decimal:4',
            'max_permissible_error' => 'decimal:4',
            'conforms' => 'boolean',
        ];
    }

    public function calibration(): BelongsTo
    {
        return $this->belongsTo(EquipmentCalibration::class, 'equipment_calibration_id');
    }

    public function calculateError(): void
    {
        $this->error = $this->indication - $this->load_applied;
        if ($this->max_permissible_error !== null) {
            $this->conforms = abs($this->error) <= abs($this->max_permissible_error);
        }
    }
}
