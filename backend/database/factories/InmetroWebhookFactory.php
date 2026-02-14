<?php

namespace Database\Factories;

use App\Models\InmetroWebhook;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroWebhookFactory extends Factory
{
    protected $model = InmetroWebhook::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'event_type' => $this->faker->randomElement(['new_lead', 'lead_expiring', 'instrument_rejected', 'lead_converted', 'churn_detected']),
            'url' => $this->faker->url() . '/webhook',
            'secret' => $this->faker->sha256(),
            'is_active' => true,
            'failure_count' => 0,
            'last_triggered_at' => null,
        ];
    }
}
