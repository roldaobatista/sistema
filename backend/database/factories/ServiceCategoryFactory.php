<?php

namespace Database\Factories;

use App\Models\ServiceCategory;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceCategoryFactory extends Factory
{
    protected $model = ServiceCategory::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->words(2, true),
            'is_active' => true,
        ];
    }
}
