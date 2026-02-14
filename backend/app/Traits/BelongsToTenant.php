<?php

namespace App\Traits;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToTenant
{
    public static function bootBelongsToTenant()
    {
        static::addGlobalScope('tenant', function (Builder $builder) {
            if (auth()->check()) {
                 // Check if user has current_tenant_id or fallback to tenant_id
                 $tenantId = auth()->user()->current_tenant_id 
                    ?? auth()->user()->tenant_id;
                    
                 if ($tenantId) {
                     $builder->where('tenant_id', $tenantId);
                 }
            }
        });

        static::creating(function ($model) {
            if (!$model->tenant_id && auth()->check()) {
                $model->tenant_id = auth()->user()->current_tenant_id 
                    ?? auth()->user()->tenant_id;
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
