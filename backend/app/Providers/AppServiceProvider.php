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

        WorkOrder::observe(WorkOrderObserver::class);

        // Price tracking
        Product::observe(PriceTrackingObserver::class);
        Service::observe(PriceTrackingObserver::class);
    }
}

