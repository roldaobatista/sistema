<?php

namespace App\Events;

use App\Models\ServiceCall;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceCallCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly ServiceCall $serviceCall,
        public readonly ?\App\Models\User $user = null,
    ) {}
}
