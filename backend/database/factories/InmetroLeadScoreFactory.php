<?php

namespace Database\Factories;

use App\Models\InmetroLeadScore;
use App\Models\InmetroOwner;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroLeadScoreFactory extends Factory
{
    protected $model = InmetroLeadScore::class;

    public function definition(): array
    {
        return [
            'owner_id' => InmetroOwner::factory(),
            'total_score' => $this->faker->numberBetween(10, 95),
            'factors' => [
                'instruments' => $this->faker->numberBetween(5, 30),
                'expiring_soon' => $this->faker->numberBetween(5, 25),
                'revenue' => $this->faker->numberBetween(5, 20),
                'contact' => $this->faker->numberBetween(0, 15),
            ],
        ];
    }
}
