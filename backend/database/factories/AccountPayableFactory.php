<?php

namespace Database\Factories;

use App\Models\AccountPayable;
use App\Models\AccountPayableCategory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AccountPayableFactory extends Factory
{
    protected $model = AccountPayable::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'created_by' => User::factory(),
            'supplier_id' => null,
            'description' => fake()->sentence(4),
            'amount' => fake()->randomFloat(2, 10, 5000),
            'due_date' => fake()->dateTimeBetween('now', '+1 month'),
            'status' => AccountPayable::STATUS_PENDING,
            'payment_method' => fake()->randomElement(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto']),
        ];
    }

    public function overdue(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AccountPayable::STATUS_PENDING, // overdue is a calculated state based on date sometimes, but let's set date past
            'due_date' => fake()->dateTimeBetween('-1 month', '-1 day'),
        ]);
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AccountPayable::STATUS_PAID,
            'amount_paid' => $attributes['amount'] ?? 100,
            'paid_at' => now(),
        ]);
    }
}
