<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FiscalAuditLog extends Model
{
    protected $fillable = [
        'tenant_id', 'fiscal_note_id', 'action', 'user_id',
        'user_name', 'ip_address', 'metadata',
    ];

    protected $casts = ['metadata' => 'array'];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function fiscalNote() { return $this->belongsTo(FiscalNote::class); }
    public function user() { return $this->belongsTo(User::class); }

    public static function log(FiscalNote $note, string $action, ?int $userId = null, ?array $meta = null): self
    {
        $user = $userId ? User::find($userId) : auth()->user();
        return self::create([
            'tenant_id' => $note->tenant_id,
            'fiscal_note_id' => $note->id,
            'action' => $action,
            'user_id' => $userId ?? auth()->id(),
            'user_name' => $user?->name,
            'ip_address' => request()->ip(),
            'metadata' => $meta,
        ]);
    }
}
