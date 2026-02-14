<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class EmployeeDocument extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'category', 'name', 'file_path',
        'expiry_date', 'issued_date', 'issuer', 'is_mandatory',
        'status', 'notes', 'uploaded_by',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'issued_date' => 'date',
        'is_mandatory' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopeExpiring($query, int $days = 30)
    {
        return $query->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addDays($days))
            ->where('expiry_date', '>=', now())
            ->where('status', '!=', 'expired');
    }

    public function scopeExpired($query)
    {
        return $query->whereNotNull('expiry_date')
            ->where('expiry_date', '<', now());
    }

    public function getCategoryLabel(): string
    {
        return match ($this->category) {
            'aso' => 'ASO',
            'nr' => 'NR (Norma Regulamentadora)',
            'contract' => 'Contrato',
            'license' => 'Habilitação/Licença',
            'certification' => 'Certificação',
            'id_doc' => 'Documento de Identidade',
            default => 'Outro',
        };
    }
}
