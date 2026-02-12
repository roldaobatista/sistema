<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Quote;
use Illuminate\Console\Command;

class CheckExpiredQuotes extends Command
{
    protected $signature = 'quotes:check-expired';
    protected $description = 'Mark quotations as expired when valid_until date has passed';

    public function handle(): int
    {
        $quotes = Quote::withoutGlobalScopes()
            ->where('status', Quote::STATUS_SENT)
            ->whereNotNull('valid_until')
            ->where('valid_until', '<', now())
            ->get();

        foreach ($quotes as $quote) {
            $quote->update(['status' => Quote::STATUS_EXPIRED]);
            app()->instance('current_tenant_id', $quote->tenant_id);
            AuditLog::log('status_changed', "Orçamento {$quote->quote_number} expirado automaticamente", $quote);
        }

        $this->info("Marked {$quotes->count()} quote(s) as expired.");
        return self::SUCCESS;
    }
}


