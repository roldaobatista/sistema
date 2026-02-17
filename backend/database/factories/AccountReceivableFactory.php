<?php

namespace Database\Factories;

use App\Models\AccountReceivable;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AccountReceivableFactory extends Factory
{
    protected $model = AccountReceivable::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => Customer::factory(),
            'created_by' => User::factory(),
            'description' => fake()->sentence(4),
            'amount' => fake()->randomFloat(2, 50, 10000),
            'amount_paid' => 0,
            'due_date' => fake()->dateTimeBetween('now', '+2 months'),
            'status' => AccountReceivable::STATUS_PENDING,
            'payment_method' => fake()->randomElement(['dinheiro', 'pix', 'cartao_credito', 'boleto', 'transferencia']),
        ];
    }

    public function overdue(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AccountReceivable::STATUS_OVERDUE,
            'due_date' => fake()->dateTimeBetween('-1 month', '-1 day'),
        ]);
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AccountReceivable::STATUS_PAID,
            'amount_paid' => $attributes['amount'] ?? 100,
            'paid_at' => now(),
        ]);
    }

    public function partial(): static
    {
        return $this->state(function (array $attributes) {
            $amount = $attributes['amount'] ?? 1000;
            return [
                'status' => AccountReceivable::STATUS_PARTIAL,
                'amount_paid' => round($amount * 0.5, 2),
            ];
        });
    }
}
