<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->words(3, true),
            'code' => 'PRD-' . fake()->unique()->numberBetween(1000, 9999),
            'unit' => fake()->randomElement(['un', 'kg', 'mt', 'cx']),
            'cost_price' => fake()->randomFloat(2, 10, 500),
            'sell_price' => fake()->randomFloat(2, 50, 1000),
            'stock_qty' => fake()->randomFloat(2, 0, 100),
            'stock_min' => fake()->randomFloat(2, 5, 20),
            'is_active' => true,
            'track_stock' => true,
        ];
    }

    public function lowStock(): static
    {
        return $this->state(fn () => [
            'stock_qty' => 2,
            'stock_min' => 10,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
