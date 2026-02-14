<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

use App\Models\Concerns\Auditable;

class CustomerContact extends Model
{
    use BelongsToTenant, Auditable;

    protected $fillable = ['tenant_id', 'customer_id', 'name', 'role', 'phone', 'email', 'is_primary'];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
