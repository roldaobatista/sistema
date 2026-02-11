<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExpenseFactory extends Factory
{
    protected $model = Expense::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'created_by' => User::factory(),
            'description' => fake()->sentence(4),
            'amount' => fake()->randomFloat(2, 10, 5000),
            'expense_date' => fake()->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
            'status' => Expense::STATUS_PENDING,
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => Expense::STATUS_APPROVED]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => [
            'status' => Expense::STATUS_REJECTED,
            'rejection_reason' => fake()->sentence(),
        ]);
    }

    public function reimbursed(): static
    {
        return $this->state(fn () => ['status' => Expense::STATUS_REIMBURSED]);
    }

    public function withTechnicianCash(): static
    {
        return $this->state(fn () => ['affects_technician_cash' => true]);
    }
}
