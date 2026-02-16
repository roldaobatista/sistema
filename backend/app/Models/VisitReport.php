<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VisitReport extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'user_id', 'checkin_id', 'deal_id',
        'visit_date', 'visit_type', 'contact_name', 'contact_role',
        'summary', 'decisions', 'next_steps', 'overall_sentiment',
        'topics', 'attachments', 'follow_up_scheduled',
        'next_contact_at', 'next_contact_type',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date',
            'topics' => 'array',
            'attachments' => 'array',
            'follow_up_scheduled' => 'boolean',
            'next_contact_at' => 'datetime',
        ];
    }

    const SENTIMENTS = [
        'positive' => 'Positivo',
        'neutral' => 'Neutro',
        'negative' => 'Negativo',
    ];

    const VISIT_TYPES = [
        'presencial' => 'Presencial',
        'virtual' => 'Virtual',
    ];

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function checkin(): BelongsTo { return $this->belongsTo(VisitCheckin::class, 'checkin_id'); }
    public function deal(): BelongsTo { return $this->belongsTo(CrmDeal::class, 'deal_id'); }
    public function commitments(): HasMany { return $this->hasMany(Commitment::class); }
}
