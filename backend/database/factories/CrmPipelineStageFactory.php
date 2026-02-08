<?php

namespace Database\Factories;

use App\Models\CrmPipelineStage;
use App\Models\CrmPipeline;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmPipelineStageFactory extends Factory
{
    protected $model = CrmPipelineStage::class;

    public function definition(): array
    {
        return [
            'pipeline_id' => CrmPipeline::factory(),
            'name' => fake()->randomElement(['Prospecção', 'Qualificação', 'Proposta', 'Negociação']),
            'color' => fake()->hexColor(),
            'sort_order' => fake()->numberBetween(0, 10),
            'probability' => fake()->numberBetween(10, 90),
            'is_won' => false,
            'is_lost' => false,
        ];
    }

    public function won(): static
    {
        return $this->state(fn () => [
            'name' => 'Ganho',
            'is_won' => true,
            'probability' => 100,
        ]);
    }

    public function lost(): static
    {
        return $this->state(fn () => [
            'name' => 'Perdido',
            'is_lost' => true,
            'probability' => 0,
        ]);
    }
}
