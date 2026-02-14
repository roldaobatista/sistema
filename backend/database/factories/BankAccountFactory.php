<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankAccountFactory extends Factory
{
    protected $model = BankAccount::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => $this->faker->company() . ' AG ' . $this->faker->numerify('####'),
            'bank_name' => $this->faker->randomElement(['Bradesco', 'Itaú', 'Banco do Brasil', 'Santander', 'Caixa']),
            'agency' => $this->faker->numerify('####'),
            'account_number' => $this->faker->numerify('#####-#'),
            'account_type' => $this->faker->randomElement(['corrente', 'poupanca', 'pagamento']),
            'pix_key' => $this->faker->optional()->email(),
            'balance' => $this->faker->randomFloat(2, 1000, 50000),
            'is_active' => true,
            'created_by' => User::factory(),
        ];
    }
}
