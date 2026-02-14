<?php

namespace App\Jobs;

use App\Models\Email;
use App\Services\Email\EmailSendService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendScheduledEmails implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct()
    {
        //
    }

    public function handle(EmailSendService $emailService): void
    {
        $emails = Email::where('status', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get();

        foreach ($emails as $email) {
            try {
                Log::info("Sending scheduled email ID: {$email->id}");
                $emailService->deliver($email);
            } catch (\Exception $e) {
                Log::error("Failed to send scheduled email ID: {$email->id}", [
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
}
