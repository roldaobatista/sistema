<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ChecklistFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => $this->faker->words(3, true),
            'description' => $this->faker->sentence(),
            'items' => [
                [
                    'id' => 'item_1',
                    'text' => 'Verificar condições ambientais',
                    'type' => 'boolean',
                    'required' => true
                ],
                [
                    'id' => 'item_2',
                    'text' => 'Foto do equipamento antes',
                    'type' => 'photo',
                    'required' => true
                ],
                [
                    'id' => 'item_3',
                    'text' => 'Observações iniciais',
                    'type' => 'text',
                    'required' => false
                ]
            ],
            'is_active' => true,
        ];
    }
}
