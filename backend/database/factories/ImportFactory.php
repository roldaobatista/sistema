<?php

namespace Database\Factories;

use App\Models\Import;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ImportFactory extends Factory
{
    protected $model = Import::class;

    public function definition(): array
    {
        $tenant = Tenant::factory()->create();

        return [
            'tenant_id' => $tenant->id,
            'user_id' => User::factory()->state([
                'tenant_id' => $tenant->id,
                'current_tenant_id' => $tenant->id,
            ]),
            'entity_type' => $this->faker->randomElement(array_keys(Import::ENTITY_TYPES)),
            'file_name' => $this->faker->word() . '.csv',
            'total_rows' => $this->faker->numberBetween(10, 500),
            'inserted' => $this->faker->numberBetween(0, 100),
            'updated' => $this->faker->numberBetween(0, 50),
            'skipped' => $this->faker->numberBetween(0, 30),
            'errors' => $this->faker->numberBetween(0, 10),
            'status' => Import::STATUS_DONE,
            'mapping' => ['name' => 'Nome', 'document' => 'CPF/CNPJ'],
            'error_log' => [],
            'separator' => ';',
            'duplicate_strategy' => Import::STRATEGY_SKIP,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn() => ['status' => Import::STATUS_PENDING]);
    }

    public function processing(): static
    {
        return $this->state(fn() => ['status' => Import::STATUS_PROCESSING]);
    }

    public function failed(): static
    {
        return $this->state(fn() => ['status' => Import::STATUS_FAILED]);
    }

    public function forCustomers(): static
    {
        return $this->state(fn() => ['entity_type' => Import::ENTITY_CUSTOMERS]);
    }

    public function forProducts(): static
    {
        return $this->state(fn() => ['entity_type' => Import::ENTITY_PRODUCTS]);
    }
}
