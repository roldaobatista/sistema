<?php

namespace Database\Factories;

use App\Models\InmetroProspectionQueue;
use App\Models\InmetroOwner;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroProspectionQueueFactory extends Factory
{
    protected $model = InmetroProspectionQueue::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'owner_id' => InmetroOwner::factory(),
            'queue_date' => now()->toDateString(),
            'position' => $this->faker->numberBetween(1, 50),
            'reason' => $this->faker->randomElement(['expiring_calibration', 'new_lead', 'follow_up', 'churn_risk']),
            'status' => 'pending',
            'suggested_script' => $this->faker->sentence,
        ];
    }
}
