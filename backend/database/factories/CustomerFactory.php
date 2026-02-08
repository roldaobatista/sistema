<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->company(),
            'type' => fake()->randomElement(['pf', 'pj']),
            'document' => fake()->numerify('##.###.###/####-##'),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'is_active' => true,
            'source' => fake()->randomElement(['indicacao', 'prospeccao', 'chamado', null]),
            'segment' => fake()->randomElement(['industrial', 'comercial', 'laboratorial', null]),
            'company_size' => fake()->randomElement(['micro', 'pequena', 'media', null]),
            'rating' => fake()->randomElement(['A', 'B', 'C', null]),
        ];
    }

    public function withContract(): static
    {
        return $this->state(fn () => [
            'contract_type' => 'anual',
            'contract_start' => now()->subMonths(10),
            'contract_end' => now()->addMonths(2),
        ]);
    }

    public function noContact(int $days = 100): static
    {
        return $this->state(fn () => [
            'last_contact_at' => now()->subDays($days),
        ]);
    }
}
