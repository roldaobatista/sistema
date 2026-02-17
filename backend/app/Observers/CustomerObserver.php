<?php

namespace App\Observers;

use App\Models\Customer;

class CustomerObserver
{
    /**
     * Handle the Customer "saved" event.
     *
     * Usa withoutEvents para evitar recursão infinita:
     * recalculateHealthScore() → update() → saved() → recalculateHealthScore() → ∞
     */
    public function saved(Customer $customer): void
    {
        if ($customer->wasChanged(['rating', 'type', 'segment', 'is_active'])) {
            Customer::withoutEvents(function () use ($customer) {
                $customer->recalculateHealthScore();
            });
        }
    }

    /**
     * Handle the Customer "created" event.
     */
    public function created(Customer $customer): void
    {
        Customer::withoutEvents(function () use ($customer) {
            $customer->recalculateHealthScore();
        });
    }
}
