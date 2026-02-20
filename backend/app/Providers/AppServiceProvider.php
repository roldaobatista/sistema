<?php

namespace App\Providers;

use App\Models\Product;
use App\Models\Quote;
use App\Models\Service;
use App\Models\WorkOrder;
use App\Observers\CrmObserver;
use App\Observers\PriceTrackingObserver;
use App\Observers\WorkOrderObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Eloquent\Model;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        if ($this->app->runningUnitTests() || env('TESTING_SQLITE_PROVIDER')) {
            $this->app->register(\App\Providers\TestingSqliteServiceProvider::class);
        }

        $this->app->bind(
            \App\Services\Fiscal\FiscalProvider::class,
            function () {
                $provider = config('services.fiscal.provider', 'focusnfe');
                return match ($provider) {
                    'nuvemfiscal' => new \App\Services\Fiscal\NuvemFiscalProvider(),
                    default => new \App\Services\Fiscal\FocusNFeProvider(),
                };
            }
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });
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

        // URL de reset de senha aponta para o frontend
        ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
            return $frontendUrl . '/redefinir-senha?token=' . $token . '&email=' . urlencode($user->getEmailForPasswordReset());
        });
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

