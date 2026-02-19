<?php

namespace App\Jobs;

use App\Models\Quote;
use App\Enums\QuoteStatus;
use App\Models\AuditLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class QuoteExpirationAlertJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function handle(): void
    {
        $alertDays = 3;

        $quotes = Quote::where('status', QuoteStatus::SENT)
            ->whereNotNull('valid_until')
            ->whereDate('valid_until', '<=', now()->addDays($alertDays))
            ->whereDate('valid_until', '>=', now())
            ->with(['seller', 'customer'])
            ->get();

        foreach ($quotes as $quote) {
            try {
                $daysLeft = (int) now()->diffInDays($quote->valid_until, false);

                AuditLog::log(
                    'expiration_alert',
                    "Orçamento {$quote->quote_number} expira em {$daysLeft} dia(s)",
                    $quote
                );

                Log::info("Quote expiration alert", [
                    'quote_id' => $quote->id,
                    'quote_number' => $quote->quote_number,
                    'days_left' => $daysLeft,
                    'valid_until' => $quote->valid_until->format('Y-m-d'),
                ]);
            } catch (\Exception $e) {
                Log::error("Quote expiration alert failed", [
                    'quote_id' => $quote->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
