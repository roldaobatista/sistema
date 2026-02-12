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
            'call_number' => 'CH-' . str_pad($this->faker->unique()->numberBetween(1, 99999), 5, '0', STR_PAD_LEFT),
            'status' => ServiceCall::STATUS_OPEN,
            'priority' => $this->faker->randomElement(['low', 'normal', 'high', 'urgent']),
            'scheduled_date' => $this->faker->optional(0.7)->dateTimeBetween('now', '+30 days'),
            'address' => $this->faker->optional(0.8)->streetAddress(),
            'city' => $this->faker->optional(0.8)->city(),
            'state' => $this->faker->optional(0.8)->randomElement(['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'ES', 'GO', 'DF']),
            'latitude' => $this->faker->optional(0.6)->latitude(-23.7, -22.5),
            'longitude' => $this->faker->optional(0.6)->longitude(-47.0, -43.0),
            'observations' => $this->faker->optional(0.5)->sentence(),
        ];
    }

    public function scheduled(): static
    {
        return $this->state(fn () => [
            'status' => ServiceCall::STATUS_SCHEDULED,
            'technician_id' => User::factory(),
            'scheduled_date' => $this->faker->dateTimeBetween('now', '+7 days'),
        ]);
    }

    public function inProgress(): static
    {
        return $this->state(fn () => [
            'status' => ServiceCall::STATUS_IN_PROGRESS,
            'technician_id' => User::factory(),
            'started_at' => now(),
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn () => [
            'status' => ServiceCall::STATUS_COMPLETED,
            'technician_id' => User::factory(),
            'started_at' => now()->subHours(2),
            'completed_at' => now(),
            'resolution_notes' => $this->faker->sentence(),
        ]);
    }
}
