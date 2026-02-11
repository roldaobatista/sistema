<?php

namespace App\Listeners;

use App\Events\CustomerCreated;
use App\Models\CrmActivity;
use App\Models\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;

class HandleCustomerCreated implements ShouldQueue
{
    public function handle(CustomerCreated $event): void
    {
        $customer = $event->customer;

        // Agendar primeiro contato de boas-vindas
        if ($customer->assigned_seller_id) {
            CrmActivity::create([
                'tenant_id' => $customer->tenant_id,
                'customer_id' => $customer->id,
                'user_id' => $customer->assigned_seller_id,
                'type' => 'follow_up',
                'title' => "Boas-vindas — {$customer->name}",
                'description' => 'Primeiro contato com novo cliente. Levantamento de necessidades e equipamentos.',
                'scheduled_at' => now()->addBusinessDay(),
            ]);

            Notification::notify(
                $customer->tenant_id,
                $customer->assigned_seller_id,
                'new_customer',
                'Novo Cliente Cadastrado',
                [
                    'message' => "O cliente {$customer->name} foi cadastrado e atribuído a você.",
                    'data' => ['customer_id' => $customer->id],
                ]
            );
        }
    }
}
