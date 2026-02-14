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
        $type = fake()->randomElement(['PF', 'PJ']);

        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->company(),
            'trade_name' => $type === 'PJ' ? fake()->company() : null,
            'type' => $type,
            'document' => $type === 'PJ'
                ? fake()->numerify('##.###.###/####-##')
                : fake()->numerify('###.###.###-##'),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'is_active' => true,
            'source' => fake()->randomElement(array_merge(array_keys(Customer::SOURCES), [null])),
            'segment' => fake()->randomElement(array_merge(array_keys(Customer::SEGMENTS), [null])),
            'company_size' => fake()->randomElement(array_merge(array_keys(Customer::COMPANY_SIZES), [null])),
            'rating' => fake()->randomElement(array_merge(array_keys(Customer::RATINGS), [null])),
        ];
    }

    public function pf(): static
    {
        return $this->state(fn () => [
            'type' => 'PF',
            'trade_name' => null,
            'document' => fake()->numerify('###.###.###-##'),
        ]);
    }

    public function pj(): static
    {
        return $this->state(fn () => [
            'type' => 'PJ',
            'trade_name' => fake()->company(),
            'document' => fake()->numerify('##.###.###/####-##'),
        ]);
    }

    public function withContract(): static
    {
        return $this->state(fn () => [
            'contract_type' => fake()->randomElement(array_keys(Customer::CONTRACT_TYPES)),
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

    public function inactive(): static
    {
        return $this->state(fn () => [
            'is_active' => false,
        ]);
    }
}
