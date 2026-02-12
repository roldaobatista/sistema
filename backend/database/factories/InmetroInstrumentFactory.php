<?php

namespace Database\Factories;

use App\Models\InmetroInstrument;
use App\Models\InmetroLocation;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroInstrumentFactory extends Factory
{
    protected $model = InmetroInstrument::class;

    public function definition(): array
    {
        return [
            'location_id' => InmetroLocation::factory(),
            'inmetro_number' => $this->faker->unique()->numerify('##########'),
            'serial_number' => $this->faker->bothify('SN-####-??'),
            'brand' => $this->faker->word,
            'model' => $this->faker->bothify('MOD-###'),
            'capacity' => '80t',
            'instrument_type' => 'Balança Rodoviária',
            'current_status' => 'approved',
            'next_verification_at' => $this->faker->dateTimeBetween('now', '+1 year'),
        ];
    }
}
