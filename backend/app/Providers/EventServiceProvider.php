<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        \App\Events\WorkOrderStarted::class => [
            \App\Listeners\LogWorkOrderStartActivity::class,
        ],
        \App\Events\WorkOrderCompleted::class => [
            \App\Listeners\HandleWorkOrderCompletion::class,
            \App\Listeners\TriggerNpsSurvey::class,
            [\App\Listeners\CreateWarrantyTrackingOnWorkOrderInvoiced::class, 'handleWorkOrderCompleted'],
        ],
        \App\Events\WorkOrderInvoiced::class => [
            \App\Listeners\HandleWorkOrderInvoicing::class,
            [\App\Listeners\CreateWarrantyTrackingOnWorkOrderInvoiced::class, 'handleWorkOrderInvoiced'],
        ],
        \App\Events\WorkOrderCancelled::class => [
            \App\Listeners\HandleWorkOrderCancellation::class,
        ],
        \App\Events\QuoteApproved::class => [
            \App\Listeners\HandleQuoteApproval::class,
            \App\Listeners\CreateCentralItemOnQuote::class,
        ],
        \App\Events\PaymentReceived::class => [
            \App\Listeners\HandlePaymentReceived::class,
            \App\Listeners\CreateCentralItemOnPayment::class,
        ],
        \App\Events\PaymentMade::class => [
            \App\Listeners\HandlePaymentMade::class,
        ],
        \App\Events\CalibrationExpiring::class => [
            \App\Listeners\HandleCalibrationExpiring::class,
            \App\Listeners\CreateCentralItemOnCalibration::class,
        ],
        \App\Events\ContractRenewing::class => [
            \App\Listeners\HandleContractRenewing::class,
            \App\Listeners\CreateCentralItemOnContract::class,
        ],
        \App\Events\CustomerCreated::class => [
            \App\Listeners\HandleCustomerCreated::class,
        ],
    ];

    /**
     * Subscribers que escutam múltiplos eventos.
     */
    protected $subscribe = [
        \App\Listeners\CreateCentralItemOnWorkOrder::class,
        \App\Listeners\CreateCentralItemOnServiceCall::class,
    ];

    public function boot(): void
    {
        parent::boot();
    }
}
