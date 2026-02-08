<?php

namespace Database\Factories;

use App\Models\CrmActivity;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmActivityFactory extends Factory
{
    protected $model = CrmActivity::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'type' => fake()->randomElement(array_keys(CrmActivity::TYPES)),
            'customer_id' => Customer::factory(),
            'user_id' => User::factory(),
            'title' => fake()->sentence(4),
            'description' => fake()->optional()->paragraph(),
            'is_automated' => false,
            'completed_at' => now(),
        ];
    }

    public function scheduled(): static
    {
        return $this->state(fn () => [
            'scheduled_at' => now()->addDays(3),
            'completed_at' => null,
        ]);
    }

    public function system(): static
    {
        return $this->state(fn () => [
            'type' => 'system',
            'is_automated' => true,
        ]);
    }
}
