<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceChecklistItem extends Model
{
    protected $fillable = [
        'checklist_id', 'description', 'type', 'is_required', 'order_index',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'order_index' => 'integer',
    ];
    
    public const TYPE_CHECK = 'check';
    public const TYPE_TEXT = 'text';
    public const TYPE_NUMBER = 'number';
    public const TYPE_PHOTO = 'photo';
    public const TYPE_YES_NO = 'yes_no';

    public function checklist(): BelongsTo
    {
        return $this->belongsTo(ServiceChecklist::class);
    }
}
