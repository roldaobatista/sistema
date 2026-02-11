<?php

namespace Database\Factories;

use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\Equipment;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuoteEquipmentFactory extends Factory
{
    protected $model = QuoteEquipment::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'quote_id' => Quote::factory(),
            'equipment_id' => Equipment::factory(),
            'description' => fake()->sentence(),
            'sort_order' => fake()->numberBetween(0, 10),
        ];
    }
}
