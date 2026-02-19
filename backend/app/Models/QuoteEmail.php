<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuoteEmail extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'quote_id', 'sent_by', 'recipient_email',
        'recipient_name', 'subject', 'status', 'message_body', 'pdf_attached',
    ];

    protected function casts(): array
    {
        return [
            'pdf_attached' => 'boolean',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
