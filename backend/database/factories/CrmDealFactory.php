<?php

namespace Database\Factories;

use App\Models\CrmDeal;
use App\Models\CrmPipeline;
use App\Models\CrmPipelineStage;
use App\Models\Customer;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmDealFactory extends Factory
{
    protected $model = CrmDeal::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => Customer::factory(),
            'pipeline_id' => CrmPipeline::factory(),
            'stage_id' => CrmPipelineStage::factory(),
            'title' => 'Deal ' . fake()->word(),
            'value' => fake()->randomFloat(2, 500, 50000),
            'probability' => fake()->numberBetween(10, 90),
            'expected_close_date' => fake()->dateTimeBetween('+1 week', '+3 months'),
            'source' => fake()->randomElement(array_keys(CrmDeal::SOURCES)),
            'status' => CrmDeal::STATUS_OPEN,
        ];
    }

    public function won(): static
    {
        return $this->state(fn () => [
            'status' => CrmDeal::STATUS_WON,
            'won_at' => now(),
            'probability' => 100,
        ]);
    }

    public function lost(): static
    {
        return $this->state(fn () => [
            'status' => CrmDeal::STATUS_LOST,
            'lost_at' => now(),
            'lost_reason' => 'Preço',
            'probability' => 0,
        ]);
    }
}
