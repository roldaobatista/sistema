<?php

namespace App\Observers;

use App\Models\Customer;

class CustomerObserver
{
    /**
     * Handle the Customer "saved" event.
     */
    public function saved(Customer $customer): void
    {
        // Recalcular Health Score apenas se campos que o influenciam mudarem
        // rating, type, segment influenciam no breakdown/calculo
        if ($customer->wasChanged(['rating', 'type', 'segment', 'is_active'])) {
             $customer->recalculateHealthScore();
        }
    }

    /**
     * Handle the Customer "created" event.
     */
    public function created(Customer $customer): void
    {
        $customer->recalculateHealthScore();
    }
}
