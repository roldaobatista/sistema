<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Equipment extends Model
{
    use BelongsToTenant, SoftDeletes, Auditable;

    protected $table = 'equipments';

    const CATEGORIES = [
        'balanca_analitica' => 'Balança Analítica',
        'balanca_semi_analitica' => 'Balança Semi-Analítica',
        'balanca_plataforma' => 'Balança de Plataforma',
        'balanca_rodoviaria' => 'Balança Rodoviária',
        'balanca_contadora' => 'Balança Contadora',
        'balanca_precisao' => 'Balança de Precisão',
        'massa_padrao' => 'Massa Padrão',
        'termometro' => 'Termômetro',
        'paquimetro' => 'Paquímetro',
        'micrometro' => 'Micrômetro',
        'manometro' => 'Manômetro',
        'outro' => 'Outro',
    ];

    const PRECISION_CLASSES = [
        'I' => 'Classe I (Especial)',
        'II' => 'Classe II (Fina)',
        'III' => 'Classe III (Média)',
        'IIII' => 'Classe IIII (Ordinária)',
    ];

    const STATUSES = [
        'ativo' => 'Ativo',
        'em_calibracao' => 'Em Calibração',
        'em_manutencao' => 'Em Manutenção',
        'fora_de_uso' => 'Fora de Uso',
        'descartado' => 'Descartado',
    ];

    protected $fillable = [
        'tenant_id', 'customer_id', 'code', 'type', 'category', 'brand',
        'manufacturer', 'model', 'serial_number', 'capacity', 'capacity_unit',
        'resolution', 'precision_class', 'status', 'location',
        'responsible_user_id', 'purchase_date', 'purchase_value',
        'warranty_expires_at', 'last_calibration_at', 'next_calibration_at',
        'calibration_interval_months', 'inmetro_number', 'certificate_number',
        'tag', 'qr_code', 'photo_url', 'is_critical', 'is_active', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'decimal:4',
            'resolution' => 'decimal:6',
            'purchase_value' => 'decimal:2',
            'purchase_date' => 'date',
            'warranty_expires_at' => 'date',
            'last_calibration_at' => 'date',
            'next_calibration_at' => 'date',
            'calibration_interval_months' => 'integer',
            'is_critical' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    // ─── Scopes ─────────────────────────────────────────────

    public function scopeCalibrationDue($q, int $days = 30)
    {
        return $q->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<=', now()->addDays($days));
    }

    public function scopeOverdue($q)
    {
        return $q->whereNotNull('next_calibration_at')
            ->where('next_calibration_at', '<', now());
    }

    public function scopeCritical($q)
    {
        return $q->where('is_critical', true);
    }

    public function scopeByCategory($q, string $cat)
    {
        return $q->where('category', $cat);
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true)->where('status', '!=', 'descartado');
    }

    // ─── Accessors ──────────────────────────────────────────

    public function getCalibrationStatusAttribute(): string
    {
        if (!$this->next_calibration_at) return 'sem_data';
        if ($this->next_calibration_at->isPast()) return 'vencida';
        if ($this->next_calibration_at->diffInDays(now()) <= 30) return 'vence_em_breve';
        return 'em_dia';
    }

    // ─── Methods ────────────────────────────────────────────

    public function scheduleNextCalibration(): void
    {
        if ($this->calibration_interval_months && $this->last_calibration_at) {
            $this->next_calibration_at = $this->last_calibration_at
                ->addMonths($this->calibration_interval_months);
            $this->save();
        }
    }

    public static function generateCode(int $tenantId): string
    {
        $last = static::where('tenant_id', $tenantId)
            ->whereNotNull('code')
            ->orderByDesc('id')
            ->value('code');

        $num = $last ? ((int) preg_replace('/\D/', '', $last)) + 1 : 1;
        return 'EQP-' . str_pad($num, 5, '0', STR_PAD_LEFT);
    }

    // ─── Relationships ──────────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function calibrations(): HasMany
    {
        return $this->hasMany(EquipmentCalibration::class)->orderByDesc('calibration_date');
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(EquipmentMaintenance::class)->orderByDesc('created_at');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EquipmentDocument::class)->orderByDesc('created_at');
    }
}
