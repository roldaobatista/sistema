<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CertificateTemplate extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'type', 'header_html', 'footer_html',
        'logo_path', 'signature_image_path', 'signatory_name',
        'signatory_title', 'signatory_registration', 'custom_fields',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'custom_fields' => 'array',
            'is_default' => 'boolean',
        ];
    }

    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }
}
