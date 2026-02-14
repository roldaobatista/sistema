<?php

namespace Database\Factories;

use App\Models\InmetroWinLoss;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroWinLossFactory extends Factory
{
    protected $model = InmetroWinLoss::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'owner_id' => null,
            'competitor_id' => null,
            'outcome' => $this->faker->randomElement(['win', 'loss']),
            'reason' => $this->faker->randomElement(['price', 'quality', 'relationship', 'speed', 'location', 'other']),
            'estimated_value' => $this->faker->randomFloat(2, 1000, 50000),
            'notes' => $this->faker->sentence(),
            'outcome_date' => now()->toDateString(),
        ];
    }
}
