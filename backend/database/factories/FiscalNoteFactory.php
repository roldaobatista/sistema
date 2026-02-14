<?php

namespace Database\Factories;

use App\Models\FiscalNote;
use App\Models\Tenant;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

class FiscalNoteFactory extends Factory
{
    protected $model = FiscalNote::class;

    public function definition(): array
    {
        return [
            'tenant_id'    => Tenant::factory(),
            'customer_id'  => Customer::factory(),
            'type'         => $this->faker->randomElement(['nfe', 'nfse']),
            'number'       => $this->faker->numberBetween(1, 99999),
            'series'       => '1',
            'access_key'   => $this->faker->numerify(str_repeat('#', 44)),
            'status'       => $this->faker->randomElement(['pending', 'authorized', 'cancelled', 'rejected']),
            'provider'     => 'nuvemfiscal',
            'provider_id'  => $this->faker->uuid(),
            'total_amount' => $this->faker->randomFloat(2, 50, 10000),
            'issued_at'    => now(),
            'pdf_url'      => null,
            'xml_url'      => null,
        ];
    }

    public function authorized(): static
    {
        return $this->state(fn() => ['status' => 'authorized']);
    }

    public function cancelled(): static
    {
        return $this->state(fn() => [
            'status'       => 'cancelled',
            'cancelled_at' => now(),
            'cancel_reason' => 'Cancelamento a pedido do cliente',
        ]);
    }

    public function nfe(): static
    {
        return $this->state(fn() => ['type' => 'nfe']);
    }

    public function nfse(): static
    {
        return $this->state(fn() => ['type' => 'nfse']);
    }
}
