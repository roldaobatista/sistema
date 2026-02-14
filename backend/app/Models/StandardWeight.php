<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class StandardWeight extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes, Auditable;

    public const STATUS_ACTIVE = 'ativo';
    public const STATUS_IN_CALIBRATION = 'em_calibracao';
    public const STATUS_OUT_OF_SERVICE = 'fora_de_uso';
    public const STATUS_DISCARDED = 'descartado';

    public const STATUSES = [
        self::STATUS_ACTIVE => ['label' => 'Ativo', 'color' => 'success'],
        self::STATUS_IN_CALIBRATION => ['label' => 'Em Calibração', 'color' => 'warning'],
        self::STATUS_OUT_OF_SERVICE => ['label' => 'Fora de Uso', 'color' => 'danger'],
        self::STATUS_DISCARDED => ['label' => 'Descartado', 'color' => 'muted'],
    ];

    public const PRECISION_CLASSES = [
        'E1' => 'Classe E1 (Referência)',
        'E2' => 'Classe E2 (Referência)',
        'F1' => 'Classe F1 (Fina)',
        'F2' => 'Classe F2 (Fina)',
        'M1' => 'Classe M1 (Média)',
        'M2' => 'Classe M2 (Média)',
        'M3' => 'Classe M3 (Ordinária)',
    ];

    public const UNITS = ['kg', 'g', 'mg'];

    public const SHAPES = [
        'cilindrico' => 'Cilíndrico',
        'retangular' => 'Retangular',
        'disco' => 'Disco',
        'paralelepipedo' => 'Paralelepípedo',
        'outro' => 'Outro',
    ];

    protected $fillable = [
        'tenant_id', 'code', 'nominal_value', 'unit', 'serial_number',
        'manufacturer', 'precision_class', 'material', 'shape',
        'certificate_number', 'certificate_date', 'certificate_expiry',
        'certificate_file', 'laboratory', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'nominal_value' => 'decimal:4',
            'certificate_date' => 'date',
            'certificate_expiry' => 'date',
        ];
    }

    // ─── Scopes ─────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeExpiring($query, int $days = 30)
    {
        return $query->whereNotNull('certificate_expiry')
            ->where('certificate_expiry', '<=', now()->addDays($days))
            ->where('certificate_expiry', '>=', now());
    }

    public function scopeExpired($query)
    {
        return $query->whereNotNull('certificate_expiry')
            ->where('certificate_expiry', '<', now());
    }

    // ─── Accessors ──────────────────────────────────────────

    public function getCertificateStatusAttribute(): string
    {
        if (!$this->certificate_expiry) {
            return 'sem_data';
        }
        if ($this->certificate_expiry->isPast()) {
            return 'vencido';
        }
        if ($this->certificate_expiry->diffInDays(now()) <= 30) {
            return 'vence_em_breve';
        }
        return 'em_dia';
    }

    public function getDisplayNameAttribute(): string
    {
        return "{$this->code} — {$this->nominal_value} {$this->unit}";
    }

    // ─── Relationships ──────────────────────────────────────

    public function calibrations(): BelongsToMany
    {
        return $this->belongsToMany(
            EquipmentCalibration::class,
            'calibration_standard_weight',
            'standard_weight_id',
            'equipment_calibration_id'
        )->withTimestamps();
    }

    // ─── Code Generation ────────────────────────────────────

    public static function generateCode(int $tenantId): string
    {
        $sequence = NumberingSequence::withoutGlobalScope('tenant')->firstOrCreate(
            ['tenant_id' => $tenantId, 'entity' => 'standard_weight'],
            ['prefix' => 'PP-', 'next_number' => 1, 'padding' => 4]
        );

        return $sequence->generateNext();
    }
}
