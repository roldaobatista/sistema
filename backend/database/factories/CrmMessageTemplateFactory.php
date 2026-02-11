<?php

namespace Database\Factories;

use App\Models\CrmMessage;
use App\Models\CrmMessageTemplate;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmMessageTemplateFactory extends Factory
{
    protected $model = CrmMessageTemplate::class;

    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->words(3, true),
            'slug' => fake()->unique()->slug(2),
            'channel' => CrmMessage::CHANNEL_WHATSAPP,
            'body' => 'Olá {{nome}}, ' . fake()->sentence(),
            'is_active' => true,
        ];
    }

    public function whatsapp(): static
    {
        return $this->state(fn () => [
            'channel' => CrmMessage::CHANNEL_WHATSAPP,
        ]);
    }

    public function email(): static
    {
        return $this->state(fn () => [
            'channel' => CrmMessage::CHANNEL_EMAIL,
            'subject' => 'Assunto: {{nome}}',
        ]);
    }

    public function withVariables(): static
    {
        return $this->state(fn () => [
            'variables' => [
                ['name' => 'nome', 'description' => 'Nome do cliente'],
                ['name' => 'valor', 'description' => 'Valor do serviço'],
            ],
        ]);
    }
}
