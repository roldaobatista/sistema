<?php

namespace Database\Factories;

use App\Models\CrmPipeline;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmPipelineFactory extends Factory
{
    protected $model = CrmPipeline::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->randomElement(['Vendas Novas', 'Recalibração', 'Manutenção']),
            'slug' => fake()->unique()->slug(2),
            'color' => fake()->hexColor(),
            'is_default' => false,
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    public function default(): static
    {
        return $this->state(fn () => ['is_default' => true, 'slug' => 'vendas-novas']);
    }

    public function recalibracao(): static
    {
        return $this->state(fn () => ['name' => 'Recalibração', 'slug' => 'recalibracao']);
    }

    public function contrato(): static
    {
        return $this->state(fn () => ['name' => 'Contrato', 'slug' => 'contrato']);
    }
}
