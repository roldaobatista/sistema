<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuoteFactory extends Factory
{
    protected $model = Quote::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => fn (array $attributes) => Customer::factory()->state(['tenant_id' => $attributes['tenant_id']]),
            'seller_id' => fn (array $attributes) => User::factory()->state(['tenant_id' => $attributes['tenant_id']]),
            'quote_number' => 'ORC-' . fake()->unique()->numberBetween(1000, 9999),
            'revision' => 1,
            'status' => Quote::STATUS_DRAFT,
            'valid_until' => now()->addDays(7),
            'subtotal' => 1000.00,
            'displacement_value' => 0,
            'total' => 1000.00,
            'source' => null,
        ];
    }
}
