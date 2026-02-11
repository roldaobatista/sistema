<?php

namespace App\Events;

use App\Models\RecurringContract;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ContractRenewing
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public RecurringContract $contract,
        public int $daysUntilEnd,
    ) {}
}
