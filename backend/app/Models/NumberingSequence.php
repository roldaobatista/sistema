<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class NumberingSequence extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'entity',
        'prefix',
        'next_number',
        'padding',
    ];

    protected function casts(): array
    {
        return [
            'tenant_id' => 'integer',
            'branch_id' => 'integer',
            'next_number' => 'integer',
            'padding' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function generateNext(): string
    {
        return DB::transaction(function () {
            $fresh = static::withoutGlobalScope('tenant')->lockForUpdate()->find($this->id);

            if (!$fresh) {
                throw new \RuntimeException('Sequência de numeração não encontrada.');
            }

            $number = $fresh->prefix . str_pad((string) $fresh->next_number, $fresh->padding, '0', STR_PAD_LEFT);

            $fresh->next_number++;
            $fresh->save();

            // Sincroniza a instância atual
            $this->next_number = $fresh->next_number;

            return $number;
        });
    }
}
