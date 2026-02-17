<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Candidate extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'job_posting_id',
        'name',
        'email',
        'phone',
        'resume_path',
        'stage',
        'notes',
        'rating',
        'rejected_reason',
    ];

    public function jobPosting()
    {
        return $this->belongsTo(JobPosting::class);
    }
}
