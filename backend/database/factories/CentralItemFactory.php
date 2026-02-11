<?php

namespace Database\Factories;

use App\Enums\CentralItemOrigin;
use App\Enums\CentralItemPriority;
use App\Enums\CentralItemStatus;
use App\Enums\CentralItemType;
use App\Enums\CentralItemVisibility;
use App\Models\CentralItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CentralItemFactory extends Factory
{
    protected $model = CentralItem::class;

    public function definition(): array
    {
        return [
            'tenant_id' => 1,
            'tipo' => fake()->randomElement(CentralItemType::cases()),
            'titulo' => fake()->sentence(4),
            'descricao_curta' => fake()->optional()->sentence(8),
            'responsavel_user_id' => User::factory(),
            'criado_por_user_id' => User::factory(),
            'status' => CentralItemStatus::ABERTO,
            'prioridade' => fake()->randomElement(CentralItemPriority::cases()),
            'origem' => CentralItemOrigin::MANUAL,
            'visibilidade' => CentralItemVisibility::EQUIPE,
            'due_at' => fake()->optional()->dateTimeBetween('now', '+7 days'),
        ];
    }

    public function tarefa(): static
    {
        return $this->state(fn () => ['tipo' => CentralItemType::TAREFA]);
    }

    public function urgente(): static
    {
        return $this->state(fn () => ['prioridade' => CentralItemPriority::URGENTE]);
    }

    public function atrasado(): static
    {
        return $this->state(fn () => [
            'due_at' => now()->subDays(2),
            'status' => CentralItemStatus::ABERTO,
        ]);
    }

    public function hoje(): static
    {
        return $this->state(fn () => ['due_at' => now()]);
    }

    public function concluido(): static
    {
        return $this->state(fn () => [
            'status' => CentralItemStatus::CONCLUIDO,
            'closed_at' => now(),
        ]);
    }

    public function emAndamento(): static
    {
        return $this->state(fn () => ['status' => CentralItemStatus::EM_ANDAMENTO]);
    }
}
