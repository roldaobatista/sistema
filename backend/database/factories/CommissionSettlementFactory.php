<?php

namespace Database\Factories;

use App\Models\CommissionSettlement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CommissionSettlementFactory extends Factory
{
    protected $model = CommissionSettlement::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'user_id' => User::factory(),
            'period' => now()->format('Y-m'),
            'total_amount' => fake()->randomFloat(2, 500, 15000),
            'events_count' => fake()->numberBetween(1, 20),
            'status' => CommissionSettlement::STATUS_OPEN,
        ];
    }

    public function closed(): static
    {
        return $this->state(fn () => [
            'status' => CommissionSettlement::STATUS_CLOSED,
            'closed_by' => User::factory(),
            'closed_at' => now(),
        ]);
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'status' => CommissionSettlement::STATUS_APPROVED,
            'closed_by' => User::factory(),
            'closed_at' => now()->subDay(),
            'approved_by' => User::factory(),
            'approved_at' => now(),
        ]);
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'status' => CommissionSettlement::STATUS_PAID,
            'closed_by' => User::factory(),
            'closed_at' => now()->subDays(2),
            'approved_by' => User::factory(),
            'approved_at' => now()->subDay(),
            'paid_at' => now(),
        ]);
    }
}
