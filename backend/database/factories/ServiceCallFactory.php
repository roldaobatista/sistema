<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\ServiceCall;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceCallFactory extends Factory
{
    protected $model = ServiceCall::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => Customer::factory(),
            'created_by' => User::factory(),
            'call_number' => 'CT-' . str_pad((string) fake()->unique()->numberBetween(1, 99999), 5, '0', STR_PAD_LEFT),
            'status' => ServiceCall::STATUS_OPEN,
            'priority' => 'normal',
            'address' => fake()->address(),
            'city' => fake()->city(),
            'state' => fake()->stateAbbr(),
            'observations' => fake()->sentence(),
        ];
    }
}
