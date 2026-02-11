<?php

namespace App\Services;

use App\Mail\QuoteReadyMail;
use App\Mail\WorkOrderStatusMail;
use App\Models\Customer;
use App\Models\Quote;
use App\Models\SystemSetting;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ClientNotificationService
{
    public function notifyOsCreated(WorkOrder $wo): void
    {
        if (!$this->isEnabled('notify_client_os_created', $wo->tenant_id)) {
            return;
        }

        $customer = $wo->customer;
        if (!$customer || !$customer->email) {
            return;
        }

        $this->sendMail($customer->email, new WorkOrderStatusMail($wo, 'created'));
    }

    public function notifyOsAwaitingApproval(WorkOrder $wo): void
    {
        if (!$this->isEnabled('notify_client_os_awaiting', $wo->tenant_id)) {
            return;
        }

        $customer = $wo->customer;
        if (!$customer || !$customer->email) {
            return;
        }

        $this->sendMail($customer->email, new WorkOrderStatusMail($wo, 'awaiting_approval'));
    }

    public function notifyOsCompleted(WorkOrder $wo): void
    {
        if (!$this->isEnabled('notify_client_os_completed', $wo->tenant_id)) {
            return;
        }

        $customer = $wo->customer;
        if (!$customer || !$customer->email) {
            return;
        }

        $this->sendMail($customer->email, new WorkOrderStatusMail($wo, 'completed'));
    }

    public function notifyQuoteReady(Quote $quote): void
    {
        if (!$this->isEnabled('notify_client_quote_ready', $quote->tenant_id)) {
            return;
        }

        $customer = $quote->customer;
        if (!$customer || !$customer->email) {
            return;
        }

        $this->sendMail($customer->email, new QuoteReadyMail($quote));
    }

    private function isEnabled(string $key, int $tenantId): bool
    {
        return (bool) SystemSetting::where('tenant_id', $tenantId)
            ->where('key', $key)
            ->value('value');
    }

    private function sendMail(string $to, $mailable): void
    {
        try {
            Mail::to($to)->queue($mailable);
        } catch (\Throwable $e) {
            Log::warning("ClientNotification: Failed to send email to {$to}", [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
