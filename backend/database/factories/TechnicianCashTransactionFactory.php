<?php

namespace Database\Factories;

use App\Models\TechnicianCashFund;
use App\Models\TechnicianCashTransaction;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class TechnicianCashTransactionFactory extends Factory
{
    protected $model = TechnicianCashTransaction::class;

    public function definition(): array
    {
        return [
            'fund_id' => TechnicianCashFund::factory(),
            'tenant_id' => fn (array $attrs) =>
                TechnicianCashFund::find($attrs['fund_id'])->tenant_id,
            'type' => $this->faker->randomElement([TechnicianCashTransaction::TYPE_CREDIT, TechnicianCashTransaction::TYPE_DEBIT]),
            'amount' => $this->faker->randomFloat(2, 10, 1000),
            'balance_after' => $this->faker->randomFloat(2, 0, 5000),
            'expense_id' => null,
            'work_order_id' => null,
            'created_by' => null,
            'description' => $this->faker->sentence(),
            'transaction_date' => $this->faker->dateTimeBetween('-30 days', 'now'),
        ];
    }

    public function credit(): static
    {
        return $this->state(['type' => TechnicianCashTransaction::TYPE_CREDIT]);
    }

    public function debit(): static
    {
        return $this->state(['type' => TechnicianCashTransaction::TYPE_DEBIT]);
    }
}
