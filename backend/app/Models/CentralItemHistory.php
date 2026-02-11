<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CentralItemHistory extends Model
{
    use HasFactory;

    protected $table = 'central_item_history';
    protected $guarded = ['id'];
    public $timestamps = false;

    public function item(): BelongsTo
    {
        return $this->belongsTo(CentralItem::class, 'central_item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
