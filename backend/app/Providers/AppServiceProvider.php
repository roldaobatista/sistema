<?php

namespace App\Providers;

use App\Models\Product;
use App\Models\Quote;
use App\Models\Service;
use App\Models\WorkOrder;
use App\Observers\CrmObserver;
use App\Observers\PriceTrackingObserver;
use App\Observers\WorkOrderObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $observer = CrmObserver::class;
        WorkOrder::updated(fn (WorkOrder $wo) => app($observer)->workOrderUpdated($wo));
        Quote::updated(fn (Quote $q) => app($observer)->quoteUpdated($q));

        // CRM & Financial triggers for Health Score / CRM Activity
        \App\Models\CrmActivity::created(fn ($activity) => $this->handleCrmActivity($activity));
        \App\Models\AccountReceivable::updated(fn ($ar) => $this->handleAccountReceivable($ar));

        WorkOrder::observe(WorkOrderObserver::class);
        \App\Models\Customer::observe(\App\Observers\CustomerObserver::class);

        // Price tracking
        Product::observe(PriceTrackingObserver::class);
        Service::observe(PriceTrackingObserver::class);

        // Tech Status Automation
        \App\Models\TimeEntry::observe(\App\Observers\TimeEntryObserver::class);
    }

    private function handleCrmActivity($activity)
    {
        if ($activity->customer && $activity->completed_at) {
            $activity->customer->update(['last_contact_at' => $activity->completed_at]);
            $activity->customer->recalculateHealthScore();
        }
    }

    private function handleAccountReceivable($ar)
    {
        if ($ar->wasChanged('status') && $ar->status === \App\Models\AccountReceivable::STATUS_PAID) {
            $ar->customer?->recalculateHealthScore();
        }
    }
}

