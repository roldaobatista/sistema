<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Quote;

class CheckExpiredQuotes extends Command
{
    protected $signature = 'quotes:check-expired';
    protected $description = 'Mark quotations as expired when valid_until date has passed';

    public function handle(): int
    {
        $count = Quote::where('status', 'sent')
            ->whereNotNull('valid_until')
            ->where('valid_until', '<', now())
            ->update(['status' => 'expired']);

        $this->info("Marked {$count} quote(s) as expired.");
        return self::SUCCESS;
    }
}
