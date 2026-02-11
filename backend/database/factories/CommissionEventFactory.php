<?php

namespace Database\Factories;

use App\Models\CommissionEvent;
use App\Models\CommissionRule;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class CommissionEventFactory extends Factory
{
    protected $model = CommissionEvent::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'commission_rule_id' => CommissionRule::factory(),
            'work_order_id' => WorkOrder::factory(),
            'user_id' => User::factory(),
            'base_amount' => fake()->randomFloat(2, 500, 10000),
            'commission_amount' => fake()->randomFloat(2, 50, 1000),
            'status' => CommissionEvent::STATUS_PENDING,
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => CommissionEvent::STATUS_APPROVED]);
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => CommissionEvent::STATUS_PAID]);
    }

    public function reversed(): static
    {
        return $this->state(fn () => ['status' => CommissionEvent::STATUS_REVERSED]);
    }
}
