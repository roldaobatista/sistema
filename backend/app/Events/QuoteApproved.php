<?php

namespace App\Events;

use App\Models\Quote;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class QuoteApproved
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Quote $quote,
        public User $user,
    ) {}
}
