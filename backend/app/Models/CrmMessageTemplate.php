<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CrmMessageTemplate extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'name', 'slug', 'channel',
        'subject', 'body', 'variables', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'variables' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }

    public function scopeByChannel($q, string $channel)
    {
        return $q->where('channel', $channel);
    }

    /**
     * Render template body with variables.
     */
    public function render(array $data): string
    {
        $body = $this->body;
        foreach ($data as $key => $value) {
            $body = str_replace("{{{$key}}}", (string) $value, $body);
        }
        return $body;
    }

    public function renderSubject(array $data): ?string
    {
        if (!$this->subject) return null;
        $subject = $this->subject;
        foreach ($data as $key => $value) {
            $subject = str_replace("{{{$key}}}", (string) $value, $subject);
        }
        return $subject;
    }
}
