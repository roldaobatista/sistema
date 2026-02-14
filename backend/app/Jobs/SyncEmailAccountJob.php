<?php

namespace App\Jobs;

use App\Models\EmailAccount;
use App\Services\Email\EmailSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncEmailAccountJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    public function __construct(
        public EmailAccount $account
    ) {
        $this->queue = 'email-sync';
    }

    public function handle(EmailSyncService $syncService): void
    {
        if (!$this->account->is_active) {
            return;
        }

        if ($this->account->sync_status === 'syncing') {
            Log::info('Email sync already running, skipping', ['account' => $this->account->id]);
            return;
        }

        $syncService->syncAccount($this->account);
    }

    public function failed(\Throwable $e): void
    {
        $this->account->markSyncError($e->getMessage());
        Log::error('SyncEmailAccountJob failed permanently', [
            'account' => $this->account->id,
            'error' => $e->getMessage(),
        ]);
    }
}
