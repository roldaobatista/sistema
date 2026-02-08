<?php

namespace App\Providers;

use App\Models\Quote;
use App\Models\WorkOrder;
use App\Observers\CrmObserver;
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
    }
}

