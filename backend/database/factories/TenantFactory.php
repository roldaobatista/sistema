<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class TenantFactory extends Factory
{
    protected $model = Tenant::class;

    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'trade_name' => fake()->optional()->company(),
            'document' => fake()->unique()->numerify('##.###.###/####-##'),
            'email' => fake()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'status' => Tenant::STATUS_ACTIVE,
            'website' => fake()->optional()->url(),
            'address_city' => fake()->optional()->city(),
            'address_state' => fake()->optional()->stateAbbr(),
        ];
    }
}
