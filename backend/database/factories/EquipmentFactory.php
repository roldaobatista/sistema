<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class EquipmentFactory extends Factory
{
    protected $model = Equipment::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'customer_id' => Customer::factory(),
            'code' => function (array $attributes) {
                // Tenta pegar tenant_id dos atributos ou cria um novo se for Factory
                $tenantId = $attributes['tenant_id'] ?? Tenant::factory()->create()->id;
                // Se for instância de Factory, resolve
                if ($tenantId instanceof \Illuminate\Database\Eloquent\Factories\Factory) {
                    $tenantId = $tenantId->create()->id;
                }
                return Equipment::generateCode($tenantId);
            },
            'type' => fake()->randomElement(['balanca_analitica', 'balanca_rodoviaria', 'termometro']),
            'brand' => fake()->company(),
            'model' => fake()->bothify('MOD-####'),
            'serial_number' => fake()->unique()->bothify('SN-########'),
            'status' => 'ativo',
            'is_active' => true,
            'is_critical' => false,
        ];
    }

    public function critical(): static
    {
        return $this->state(fn () => [
            'is_critical' => true,
        ]);
    }

    public function calibrationDue(): static
    {
        return $this->state(fn () => [
            'next_calibration_at' => now()->addDays(15),
            'last_calibration_at' => now()->subMonths(11),
            'calibration_interval_months' => 12,
        ]);
    }

    public function overdue(): static
    {
        return $this->state(fn () => [
            'next_calibration_at' => now()->subDays(10),
            'last_calibration_at' => now()->subMonths(13),
            'calibration_interval_months' => 12,
        ]);
    }
}
