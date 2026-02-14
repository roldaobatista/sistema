<?php

namespace Database\Factories;

use App\Models\InmetroComplianceChecklist;
use Illuminate\Database\Eloquent\Factories\Factory;

class InmetroComplianceChecklistFactory extends Factory
{
    protected $model = InmetroComplianceChecklist::class;

    public function definition(): array
    {
        return [
            'tenant_id' => 1,
            'instrument_type' => $this->faker->randomElement(['balanca_rodoviaria', 'balanca_comercial', 'balanca_industrial', 'medidor_vazao']),
            'regulation_reference' => 'Portaria ' . $this->faker->numberBetween(100, 999) . '/' . $this->faker->year(),
            'title' => 'Checklist de ' . $this->faker->word(),
            'items' => [
                'Verificar selo de conformidade',
                'Conferir certificado de calibração vigente',
                'Teste de repetibilidade',
                'Verificar excentricidade',
            ],
            'is_active' => true,
        ];
    }
}
