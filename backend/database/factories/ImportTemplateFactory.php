<?php

namespace Database\Factories;

use App\Models\ImportTemplate;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ImportTemplateFactory extends Factory
{
    protected $model = ImportTemplate::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'entity_type' => $this->faker->randomElement(['customers', 'products', 'services', 'equipments', 'suppliers']),
            'name' => $this->faker->words(2, true),
            'mapping' => ['name' => 'Nome', 'document' => 'CPF'],
        ];
    }
}
