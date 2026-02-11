<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\NumberingSequence;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class NumberingSequenceFactory extends Factory
{
    protected $model = NumberingSequence::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'branch_id' => null,
            'entity' => fake()->randomElement(['work_order', 'receipt', 'invoice', 'quote', 'equipment']),
            'prefix' => fake()->randomElement(['OS', 'RC', 'NF', 'ORC', 'EQ']),
            'next_number' => 1,
            'padding' => 6,
        ];
    }

    public function forBranch(Branch $branch): static
    {
        return $this->state([
            'tenant_id' => $branch->tenant_id,
            'branch_id' => $branch->id,
        ]);
    }
}
