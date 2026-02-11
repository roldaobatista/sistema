<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class BranchFactory extends Factory
{
    protected $model = Branch::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->city() . ' - Filial',
            'code' => fake()->unique()->bothify('??##'),
            'address_street' => fake()->streetName(),
            'address_number' => fake()->buildingNumber(),
            'address_complement' => fake()->optional()->secondaryAddress(),
            'address_neighborhood' => fake()->citySuffix(),
            'address_city' => fake()->city(),
            'address_state' => fake()->stateAbbr(),
            'address_zip' => fake()->numerify('#####-###'),
            'phone' => fake()->phoneNumber(),
            'email' => fake()->companyEmail(),
        ];
    }
}
