<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportantDate extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'title', 'type', 'date',
        'recurring_yearly', 'remind_days_before', 'contact_name',
        'notes', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'recurring_yearly' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    const TYPES = [
        'birthday' => 'Aniversário',
        'company_anniversary' => 'Aniversário da Empresa',
        'contract_start' => 'Início do Contrato',
        'custom' => 'Personalizado',
    ];

    public function scopeUpcoming($q, int $days = 30)
    {
        $start = now()->startOfDay();
        $end = now()->addDays($days)->endOfDay();
        return $q->where('is_active', true)
            ->where(function ($query) use ($start, $end) {
                $query->whereBetween('date', [$start->toDateString(), $end->toDateString()]);
            });
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
}
