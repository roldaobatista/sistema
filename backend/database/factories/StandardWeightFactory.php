<?php

namespace Database\Factories;

use App\Models\StandardWeight;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class StandardWeightFactory extends Factory
{
    protected $model = StandardWeight::class;

    public function definition(): array
    {
        $units = StandardWeight::UNITS;
        $classes = array_keys(StandardWeight::PRECISION_CLASSES);
        $shapes = array_keys(StandardWeight::SHAPES);
        $statuses = array_keys(StandardWeight::STATUSES);

        return [
            'tenant_id' => Tenant::factory(),
            'code' => 'PP-' . str_pad($this->faker->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'nominal_value' => $this->faker->randomElement([0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]),
            'unit' => $this->faker->randomElement($units),
            'serial_number' => $this->faker->optional()->numerify('SN-######'),
            'manufacturer' => $this->faker->optional()->company(),
            'precision_class' => $this->faker->randomElement($classes),
            'material' => $this->faker->randomElement(['Aço Inox', 'Ferro Fundido', 'Latão', 'Alumínio']),
            'shape' => $this->faker->randomElement($shapes),
            'certificate_number' => $this->faker->optional()->numerify('CERT-####/2026'),
            'certificate_date' => $this->faker->optional()->dateTimeBetween('-1 year', 'now'),
            'certificate_expiry' => $this->faker->optional()->dateTimeBetween('+1 month', '+2 years'),
            'laboratory' => $this->faker->optional()->company() . ' Metrologia',
            'status' => $this->faker->randomElement($statuses),
            'notes' => $this->faker->optional()->sentence(),
        ];
    }

    public function active(): static
    {
        return $this->state(fn () => ['status' => StandardWeight::STATUS_ACTIVE]);
    }

    public function expiring(int $days = 15): static
    {
        return $this->state(fn () => [
            'certificate_expiry' => now()->addDays($days),
            'certificate_date' => now()->subYear(),
            'status' => StandardWeight::STATUS_ACTIVE,
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn () => [
            'certificate_expiry' => now()->subDays(10),
            'certificate_date' => now()->subYear(),
            'status' => StandardWeight::STATUS_ACTIVE,
        ]);
    }
}
