<?php

namespace Database\Factories;

use App\Models\InmetroCompetitorSnapshot;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroCompetitorSnapshotFactory extends Factory
{
    protected $model = InmetroCompetitorSnapshot::class;

    public function definition(): array
    {
        return [
            'tenant_id' => 1,
            'period_start' => now()->startOfMonth(),
            'period_end' => now()->endOfMonth(),
            'data' => [
                'total_instruments' => $this->faker->numberBetween(100, 5000),
                'our_share' => $this->faker->numberBetween(10, 40),
                'competitor_shares' => [
                    ['name' => 'Competitor A', 'share' => $this->faker->numberBetween(5, 30)],
                    ['name' => 'Competitor B', 'share' => $this->faker->numberBetween(5, 20)],
                ],
            ],
        ];
    }
}
