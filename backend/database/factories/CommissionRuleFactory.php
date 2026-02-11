<?php

namespace Database\Factories;

use App\Models\CommissionRule;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CommissionRuleFactory extends Factory
{
    protected $model = CommissionRule::class;

    public function definition(): array
    {
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'user_id' => User::factory(),
            'name' => fake()->words(3, true) . ' Commission',
            'type' => CommissionRule::TYPE_PERCENTAGE,
            'value' => fake()->randomFloat(2, 1, 20),
            'applies_to' => CommissionRule::APPLIES_ALL,
            'calculation_type' => CommissionRule::CALC_PERCENT_GROSS,
            'applies_to_role' => CommissionRule::ROLE_TECHNICIAN,
            'applies_when' => CommissionRule::WHEN_OS_COMPLETED,
            'active' => true,
            'priority' => 0,
        ];
    }

    public function fixed(): static
    {
        return $this->state(fn () => [
            'type' => CommissionRule::TYPE_FIXED,
            'calculation_type' => CommissionRule::CALC_FIXED_PER_OS,
            'value' => fake()->randomFloat(2, 50, 500),
        ]);
    }

    public function forSeller(): static
    {
        return $this->state(fn () => ['applies_to_role' => CommissionRule::ROLE_SELLER]);
    }

    public function forDriver(): static
    {
        return $this->state(fn () => ['applies_to_role' => CommissionRule::ROLE_DRIVER]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['active' => false]);
    }
}
