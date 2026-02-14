<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\User;
use App\Notifications\OverdueFollowUpNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class CheckOverdueFollowUps extends Command
{
    protected $signature = 'customers:check-overdue-follow-ups
                            {--days=0 : Days overdue threshold (0 = today and past)}
                            {--no-contact-days=90 : Alert customers without any contact for this many days}';

    protected $description = 'Check for customers with overdue follow-ups and no recent contact. Sends notifications to assigned sellers.';

    public function handle(): int
    {
        $overdueThreshold = (int) $this->option('days');
        $noContactDays = (int) $this->option('no-contact-days');

        $this->info("Checking overdue follow-ups (threshold: {$overdueThreshold} days)...");

        // 1. Customers with overdue next_follow_up_at
        $overdueCustomers = Customer::needsFollowUp()
            ->with('assignedSeller:id,name,email')
            ->get();

        $this->info("Found {$overdueCustomers->count()} customers with overdue follow-ups.");

        $notificationsSent = 0;

        foreach ($overdueCustomers as $customer) {
            $seller = $customer->assignedSeller;
            if (!$seller) {
                $this->warn("  → {$customer->name}: no assigned seller, skipping.");
                continue;
            }

            try {
                $seller->notify(new OverdueFollowUpNotification($customer, 'overdue_follow_up'));
                $notificationsSent++;
                $this->line("  ✓ Notified {$seller->name} about {$customer->name}");
            } catch (\Exception $e) {
                Log::error('Failed to send overdue follow-up notification', [
                    'customer_id' => $customer->id,
                    'seller_id' => $seller->id,
                    'error' => $e->getMessage(),
                ]);
                $this->error("  ✗ Failed: {$customer->name} - {$e->getMessage()}");
            }
        }

        // 2. Customers without any contact for N days
        $forgottenCustomers = Customer::noContactSince($noContactDays)
            ->where('is_active', true)
            ->with('assignedSeller:id,name,email')
            ->whereNotIn('id', $overdueCustomers->pluck('id'))
            ->get();

        $this->info("Found {$forgottenCustomers->count()} customers without contact for {$noContactDays}+ days.");

        foreach ($forgottenCustomers as $customer) {
            $seller = $customer->assignedSeller;
            if (!$seller) continue;

            try {
                $seller->notify(new OverdueFollowUpNotification($customer, 'no_contact'));
                $notificationsSent++;
                $this->line("  ✓ Notified {$seller->name} about forgotten {$customer->name}");
            } catch (\Exception $e) {
                Log::error('Failed to send no-contact notification', [
                    'customer_id' => $customer->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Done. {$notificationsSent} notifications sent.");

        return self::SUCCESS;
    }
}
