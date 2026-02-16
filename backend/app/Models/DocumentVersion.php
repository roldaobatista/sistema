<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DocumentVersion extends Model
{
    use BelongsToTenant, SoftDeletes;

    public const CATEGORIES = [
        'procedure' => 'Procedimento',
        'instruction' => 'Instrução de Trabalho',
        'form' => 'Formulário',
        'record' => 'Registro',
        'policy' => 'Política',
        'manual' => 'Manual',
    ];

    protected $fillable = [
        'tenant_id', 'document_code', 'title', 'category', 'version',
        'description', 'file_path', 'status', 'created_by', 'approved_by',
        'approved_at', 'effective_date', 'review_date',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'effective_date' => 'date',
            'review_date' => 'date',
        ];
    }

    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
}
