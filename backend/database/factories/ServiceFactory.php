<?php

namespace Database\Factories;

use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceFactory extends Factory
{
    protected $model = Service::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'category_id' => ServiceCategory::factory(), // Assuming ServiceCategoryFactory exists, if not, might need to create it or make optional
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'default_price' => fake()->randomFloat(2, 50, 500),
            'estimated_minutes' => fake()->numberBetween(30, 240),
            'is_active' => true,
        ];
    }
}
