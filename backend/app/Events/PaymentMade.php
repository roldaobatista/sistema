<?php

namespace App\Events;

use App\Models\AccountPayable;
use App\Models\Payment;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentMade
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public AccountPayable $accountPayable,
        public ?Payment $payment = null,
    ) {}
}
