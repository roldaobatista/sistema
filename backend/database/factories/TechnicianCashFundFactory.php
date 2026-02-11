<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\TechnicianCashFund;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class TechnicianCashFundFactory extends Factory
{
    protected $model = TechnicianCashFund::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'user_id' => fn (array $attrs) =>
                User::factory()->create(['tenant_id' => $attrs['tenant_id']])->id,
            'balance' => $this->faker->randomFloat(2, 0, 5000),
        ];
    }

    public function empty(): static
    {
        return $this->state(['balance' => 0]);
    }
}
