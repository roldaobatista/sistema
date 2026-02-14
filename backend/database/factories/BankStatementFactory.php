<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\BankStatement;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankStatementFactory extends Factory
{
    protected $model = BankStatement::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'bank_account_id' => BankAccount::factory(),
            'filename' => $this->faker->word . '.ofx',
            'format' => 'ofx',
            'imported_at' => now(),
            'created_by' => User::factory(),
            'total_entries' => 10,
            'matched_entries' => 0,
        ];
    }
}
