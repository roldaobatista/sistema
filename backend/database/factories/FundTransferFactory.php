<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\FundTransfer;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class FundTransferFactory extends Factory
{
    protected $model = FundTransfer::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'bank_account_id' => BankAccount::factory(),
            'to_user_id' => User::factory(),
            'amount' => $this->faker->randomFloat(2, 100, 5000),
            'transfer_date' => $this->faker->date(),
            'payment_method' => $this->faker->randomElement(['pix', 'ted', 'dinheiro', 'transferencia']),
            'description' => $this->faker->sentence(),
            'status' => FundTransfer::STATUS_COMPLETED,
            'created_by' => User::factory(),
        ];
    }
}
