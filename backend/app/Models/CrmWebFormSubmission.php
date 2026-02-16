<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmWebFormSubmission extends Model
{
    protected $table = 'crm_web_form_submissions';

    protected $fillable = [
        'form_id', 'customer_id', 'deal_id', 'data',
        'ip_address', 'user_agent', 'utm_source',
        'utm_medium', 'utm_campaign',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
        ];
    }

    // ─── Relationships ──────────────────────────────────

    public function form(): BelongsTo
    {
        return $this->belongsTo(CrmWebForm::class, 'form_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(CrmDeal::class, 'deal_id');
    }
}
