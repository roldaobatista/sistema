<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class VisitSurvey extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'customer_id', 'checkin_id', 'user_id',
        'token', 'rating', 'comment', 'status',
        'sent_at', 'answered_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'answered_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    const STATUSES = [
        'pending' => 'Pendente',
        'answered' => 'Respondida',
        'expired' => 'Expirada',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $survey) {
            if (empty($survey->token)) {
                $survey->token = Str::random(64);
            }
        });
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function checkin(): BelongsTo { return $this->belongsTo(VisitCheckin::class, 'checkin_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
