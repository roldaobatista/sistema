<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class EmailRule extends Model
{
    use BelongsToTenant;

    protected $guarded = ['id'];

    protected $casts = [
        'is_active' => 'boolean',
        'priority' => 'integer',
        'conditions' => 'array',
        'actions' => 'array',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('priority');
    }

    public function matchesEmail(Email $email): bool
    {
        foreach ($this->conditions as $condition) {
            if (!$this->evaluateCondition($condition, $email)) {
                return false;
            }
        }
        return true;
    }

    private function evaluateCondition(array $condition, Email $email): bool
    {
        $field = $condition['field'] ?? '';
        $operator = $condition['operator'] ?? 'contains';
        $value = $condition['value'] ?? '';

        $emailValue = match ($field) {
            'from_address' => $email->from_address,
            'from_name' => $email->from_name,
            'subject' => $email->subject,
            'body' => $email->body_text,
            'ai_category' => $email->ai_category,
            'ai_priority' => $email->ai_priority,
            'ai_sentiment' => $email->ai_sentiment,
            'has_attachments' => $email->has_attachments ? 'true' : 'false',
            'customer_id' => (string) $email->customer_id,
            default => null,
        };

        if ($emailValue === null) {
            return false;
        }

        return match ($operator) {
            'contains' => str_contains(strtolower($emailValue), strtolower($value)),
            'not_contains' => !str_contains(strtolower($emailValue), strtolower($value)),
            'equals' => strtolower($emailValue) === strtolower($value),
            'not_equals' => strtolower($emailValue) !== strtolower($value),
            'starts_with' => str_starts_with(strtolower($emailValue), strtolower($value)),
            'ends_with' => str_ends_with(strtolower($emailValue), strtolower($value)),
            'regex' => (bool) preg_match("/{$value}/i", $emailValue),
            default => false,
        };
    }
}
