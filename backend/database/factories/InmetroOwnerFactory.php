<?php

namespace Database\Factories;

use App\Models\InmetroOwner;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroOwnerFactory extends Factory
{
    protected $model = InmetroOwner::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'document' => $this->faker->unique()->numerify('##############'),
            'name' => $this->faker->company,
            'trade_name' => $this->faker->company,
            'type' => 'PJ',
            'phone' => $this->faker->phoneNumber,
            'email' => $this->faker->companyEmail,
            'lead_status' => 'new',
            'priority' => 'normal',
        ];
    }
}
