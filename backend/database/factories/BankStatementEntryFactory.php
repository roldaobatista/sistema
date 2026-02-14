<?php

namespace Database\Factories;

use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankStatementEntryFactory extends Factory
{
    protected $model = BankStatementEntry::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'bank_statement_id' => BankStatement::factory(),
            'date' => $this->faker->date(),
            'description' => $this->faker->sentence(3),
            'amount' => $this->faker->randomFloat(2, -1000, 1000),
            'type' => $this->faker->randomElement(['credit', 'debit']),
            'status' => 'pending',
            'transaction_id' => $this->faker->uuid,
        ];
    }
}
