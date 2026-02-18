<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FiscalTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'type', 'template_data',
        'usage_count', 'created_by',
    ];

    protected $casts = ['template_data' => 'array'];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }

    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }
}
