<?php

namespace App\Jobs;

use App\Models\Email;
use App\Services\Email\EmailClassifierService;
use App\Services\Email\EmailRuleEngine;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ClassifyEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;
    public int $backoff = 5;

    public function __construct(
        public Email $email
    ) {
        $this->queue = 'email-classify';
    }

    public function handle(
        EmailClassifierService $classifier,
        EmailRuleEngine $ruleEngine
    ): void {
        // Skip if already classified
        if ($this->email->ai_classified_at) {
            return;
        }

        // Classify with AI
        $classified = $classifier->classify($this->email);

        // Apply automation rules
        $ruleEngine->apply($classified);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('ClassifyEmailJob failed', [
            'email_id' => $this->email->id,
            'error' => $e->getMessage(),
        ]);
    }
}
