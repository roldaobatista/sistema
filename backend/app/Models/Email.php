<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;

class Email extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id'];

    protected $casts = [
        'to_addresses' => 'array',
        'cc_addresses' => 'array',
        'date' => 'datetime',
        'is_read' => 'boolean',
        'is_starred' => 'boolean',
        'is_archived' => 'boolean',
        'has_attachments' => 'boolean',
        'ai_confidence' => 'decimal:2',
        'ai_classified_at' => 'datetime',
        'uid' => 'integer',
        // Phase 2
        'scheduled_at' => 'datetime',
        'sent_at' => 'datetime',
        'last_read_at' => 'datetime',
        'snoozed_until' => 'datetime',
        'assigned_at' => 'datetime',
    ];

    // --- Relationships ---

    public function account(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class, 'email_account_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(EmailNote::class)->orderBy('created_at', 'desc');
    }

    public function tags()
    {
        return $this->belongsToMany(EmailTag::class, 'email_email_tag');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(EmailActivity::class)->orderBy('created_at', 'desc');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(EmailAttachment::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function linked(): MorphTo
    {
        return $this->morphTo();
    }

    // --- Scopes ---

    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }

    public function scopeStarred(Builder $query): Builder
    {
        return $query->where('is_starred', true);
    }

    public function scopeInbox(Builder $query): Builder
    {
        return $query->where('folder', 'INBOX')
                     ->where('is_archived', false)
                     ->where('direction', 'inbound');
    }

    public function scopeSent(Builder $query): Builder
    {
        return $query->where('direction', 'outbound');
    }

    public function scopeCategory(Builder $query, string $category): Builder
    {
        return $query->where('ai_category', $category);
    }

    public function scopeFromCustomer(Builder $query, int $customerId): Builder
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeForAccount(Builder $query, int $accountId): Builder
    {
        return $query->where('email_account_id', $accountId);
    }

    // --- Accessors ---

    public function getIsClassifiedAttribute(): bool
    {
        return $this->ai_classified_at !== null;
    }

    public function getSnippetTextAttribute(): string
    {
        if ($this->snippet) {
            return $this->snippet;
        }

        return Str::limit(strip_tags($this->body_text ?? $this->body_html ?? ''), 200);
    }

    // --- Thread helpers ---

    public function thread(): HasMany
    {
        return $this->hasMany(self::class, 'thread_id', 'thread_id');
    }

    public static function resolveThreadId(string $messageId, ?string $inReplyTo, ?string $references = null): string
    {
        if ($inReplyTo) {
            $existing = self::where('message_id', $inReplyTo)->value('thread_id');
            if ($existing) {
                return $existing;
            }
        }

        if ($references) {
            $refs = preg_split('/\s+/', trim($references));
            $firstRef = $refs[0] ?? null;
            if ($firstRef) {
                $existing = self::where('message_id', $firstRef)->value('thread_id');
                if ($existing) {
                    return $existing;
                }
            }
        }

        return md5($messageId);
    }
}
