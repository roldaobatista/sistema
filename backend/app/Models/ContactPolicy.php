<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContactPolicy extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'name', 'target_type', 'target_value',
        'max_days_without_contact', 'warning_days_before',
        'preferred_contact_type', 'is_active', 'priority',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    const TARGET_TYPES = [
        'rating' => 'Rating',
        'segment' => 'Segmento',
        'all' => 'Todos',
    ];

    public function scopeActive($q) { return $q->where('is_active', true); }

    public static function getApplicablePolicy(Customer $customer): ?self
    {
        return static::where('tenant_id', $customer->tenant_id)
            ->where('is_active', true)
            ->where(function ($q) use ($customer) {
                $q->where('target_type', 'all')
                    ->orWhere(function ($q) use ($customer) {
                        $q->where('target_type', 'rating')->where('target_value', $customer->rating);
                    })
                    ->orWhere(function ($q) use ($customer) {
                        $q->where('target_type', 'segment')->where('target_value', $customer->segment);
                    });
            })
            ->orderByDesc('priority')
            ->first();
    }
}
