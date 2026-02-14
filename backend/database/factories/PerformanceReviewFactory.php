<?php

namespace Database\Factories;

use App\Models\PerformanceReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PerformanceReviewFactory extends Factory
{
    protected $model = PerformanceReview::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'user_id' => User::factory(),
            'reviewer_id' => User::factory(),
            'cycle' => 'Q1 ' . $this->faker->year,
            'year' => $this->faker->year,
            'type' => $this->faker->randomElement(['self', 'peer', 'manager', '360']),
            'status' => 'draft',
            'ratings' => [],
            'okrs' => [],
            'nine_box_potential' => $this->faker->numberBetween(1, 3),
            'nine_box_performance' => $this->faker->numberBetween(1, 3),
            'action_plan' => $this->faker->paragraph,
            'comments' => $this->faker->text,
        ];
    }
}
