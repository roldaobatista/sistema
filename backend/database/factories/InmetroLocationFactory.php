<?php

namespace Database\Factories;

use App\Models\InmetroLocation;
use App\Models\InmetroOwner;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroLocationFactory extends Factory
{
    protected $model = InmetroLocation::class;

    public function definition(): array
    {
        return [
            'owner_id' => InmetroOwner::factory(),
            'address_zip' => $this->faker->postcode,
            'address_street' => $this->faker->streetName,
            'address_number' => $this->faker->buildingNumber,
            'address_city' => $this->faker->city,
            'address_state' => 'MT',
        ];
    }
}
