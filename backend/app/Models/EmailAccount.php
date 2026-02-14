<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailAccount extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id'];

    protected $hidden = ['imap_password'];

    protected $casts = [
        'imap_password' => 'encrypted',
        'imap_port' => 'integer',
        'smtp_port' => 'integer',
        'is_active' => 'boolean',
        'last_sync_at' => 'datetime',
        'last_sync_uid' => 'integer',
    ];

    public function emails(): HasMany
    {
        return $this->hasMany(Email::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function markSyncing(): void
    {
        $this->update(['sync_status' => 'syncing', 'sync_error' => null]);
    }

    public function markSynced(int $lastUid): void
    {
        $this->update([
            'sync_status' => 'idle',
            'last_sync_at' => now(),
            'last_sync_uid' => $lastUid,
            'sync_error' => null,
        ]);
    }

    public function markSyncError(string $error): void
    {
        $this->update([
            'sync_status' => 'error',
            'sync_error' => $error,
        ]);
    }
}
