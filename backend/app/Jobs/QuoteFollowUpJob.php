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
use Illuminate\Support\Facades\Notification;

class QuoteFollowUpJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function handle(): void
    {
        $daysThreshold = 3;
        $maxFollowups = 3;

        $quotes = Quote::where('status', QuoteStatus::SENT)
            ->where('followup_count', '<', $maxFollowups)
            ->where(function ($q) use ($daysThreshold) {
                $q->whereNull('last_followup_at')
                    ->where('sent_at', '<=', now()->subDays($daysThreshold))
                    ->orWhere('last_followup_at', '<=', now()->subDays($daysThreshold));
            })
            ->with(['seller', 'customer'])
            ->get();

        foreach ($quotes as $quote) {
            try {
                $quote->increment('followup_count');
                $quote->update(['last_followup_at' => now()]);

                AuditLog::log(
                    'followup_reminder',
                    "Follow-up #{$quote->followup_count} para orçamento {$quote->quote_number}",
                    $quote
                );

                Log::info("Quote follow-up sent", [
                    'quote_id' => $quote->id,
                    'quote_number' => $quote->quote_number,
                    'followup_count' => $quote->followup_count,
                ]);
            } catch (\Exception $e) {
                Log::error("Quote follow-up failed", [
                    'quote_id' => $quote->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
