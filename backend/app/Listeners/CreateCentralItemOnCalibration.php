<?php

namespace App\Listeners;

use App\Enums\CentralItemPriority;
use App\Enums\CentralItemType;
use App\Events\CalibrationExpiring;
use App\Models\CentralItem;
use Illuminate\Contracts\Queue\ShouldQueue;

class CreateCentralItemOnCalibration implements ShouldQueue
{
    public function handle(CalibrationExpiring $event): void
    {
        $equipment = $event->equipment;

        $responsavel = $equipment->technician_user_id ?? $equipment->created_by ?? auth()->id();

        CentralItem::criarDeOrigem(
            model: $equipment,
            tipo: CentralItemType::CALIBRACAO,
            titulo: "Calibração vencendo — {$equipment->code} ({$equipment->brand} {$equipment->model})",
            responsavelId: $responsavel,
            extras: [
                'prioridade' => CentralItemPriority::ALTA,
                'due_at' => $equipment->next_calibration_at,
                'descricao_curta' => "Cliente: {$equipment->customer?->name}",
                'contexto' => [
                    'equipamento_id' => $equipment->id,
                    'codigo' => $equipment->code,
                    'cliente' => $equipment->customer?->name,
                    'proxima_calibracao' => $equipment->next_calibration_at?->toDateString(),
                    'link' => "/equipamentos/{$equipment->id}",
                ],
            ]
        );
    }
}
