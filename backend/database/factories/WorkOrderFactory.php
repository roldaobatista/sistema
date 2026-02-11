<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkOrderFactory extends Factory
{
    protected $model = WorkOrder::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => Customer::factory(),
            'created_by' => User::factory(),
            'number' => 'OS-' . str_pad(fake()->unique()->numberBetween(1, 99999), 6, '0', STR_PAD_LEFT),
            'status' => WorkOrder::STATUS_OPEN,
            'priority' => WorkOrder::PRIORITY_NORMAL,
            'description' => fake()->sentence(6),
            'total' => 0,
            'origin_type' => WorkOrder::ORIGIN_MANUAL,
            'displacement_value' => 0,
        ];
    }

    public function inProgress(): static
    {
        return $this->state(fn () => [
            'status' => WorkOrder::STATUS_IN_PROGRESS,
            'started_at' => now(),
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn () => [
            'status' => WorkOrder::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);
    }

    public function delivered(): static
    {
        return $this->state(fn () => [
            'status' => WorkOrder::STATUS_DELIVERED,
            'completed_at' => now()->subDay(),
            'delivered_at' => now(),
        ]);
    }

    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => WorkOrder::STATUS_CANCELLED]);
    }
}
