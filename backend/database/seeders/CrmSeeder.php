<?php

namespace Database\Seeders;

use App\Models\CrmPipeline;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class CrmSeeder extends Seeder
{
    public function run(): void
    {
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            $this->seedPipelines($tenant->id);
        }
    }

    private function seedPipelines(int $tenantId): void
    {
        $pipelines = [
            [
                'name' => 'Vendas Novas',
                'slug' => 'vendas-novas',
                'color' => '#3b82f6',
                'is_default' => true,
                'sort_order' => 0,
                'stages' => [
                    ['name' => 'Prospecção', 'color' => '#94a3b8', 'probability' => 10],
                    ['name' => 'Qualificação', 'color' => '#60a5fa', 'probability' => 25],
                    ['name' => 'Visita Técnica', 'color' => '#38bdf8', 'probability' => 40],
                    ['name' => 'Proposta Enviada', 'color' => '#facc15', 'probability' => 60],
                    ['name' => 'Negociação', 'color' => '#fb923c', 'probability' => 80],
                    ['name' => 'Fechamento', 'color' => '#22c55e', 'probability' => 100, 'is_won' => true],
                    ['name' => 'Perdido', 'color' => '#ef4444', 'probability' => 0, 'is_lost' => true],
                ],
            ],
            [
                'name' => 'Recalibração',
                'slug' => 'recalibracao',
                'color' => '#f59e0b',
                'is_default' => false,
                'sort_order' => 1,
                'stages' => [
                    ['name' => 'Vencimento Detectado', 'color' => '#fbbf24', 'probability' => 20],
                    ['name' => 'Contato Realizado', 'color' => '#60a5fa', 'probability' => 50],
                    ['name' => 'Agendamento', 'color' => '#38bdf8', 'probability' => 75],
                    ['name' => 'Calibração Realizada', 'color' => '#22c55e', 'probability' => 100, 'is_won' => true],
                    ['name' => 'Não Realizada', 'color' => '#ef4444', 'probability' => 0, 'is_lost' => true],
                ],
            ],
            [
                'name' => 'Manutenção / Reparo',
                'slug' => 'manutencao-reparo',
                'color' => '#8b5cf6',
                'is_default' => false,
                'sort_order' => 2,
                'stages' => [
                    ['name' => 'Chamado Recebido', 'color' => '#94a3b8', 'probability' => 15],
                    ['name' => 'Diagnóstico', 'color' => '#60a5fa', 'probability' => 30],
                    ['name' => 'Orçamento Enviado', 'color' => '#facc15', 'probability' => 50],
                    ['name' => 'Aprovação', 'color' => '#fb923c', 'probability' => 70],
                    ['name' => 'Serviço em Andamento', 'color' => '#38bdf8', 'probability' => 90],
                    ['name' => 'Entrega / Concluído', 'color' => '#22c55e', 'probability' => 100, 'is_won' => true],
                    ['name' => 'Recusado', 'color' => '#ef4444', 'probability' => 0, 'is_lost' => true],
                ],
            ],
            [
                'name' => 'Contrato',
                'slug' => 'contrato',
                'color' => '#06b6d4',
                'is_default' => false,
                'sort_order' => 3,
                'stages' => [
                    ['name' => 'Proposta', 'color' => '#94a3b8', 'probability' => 20],
                    ['name' => 'Análise', 'color' => '#60a5fa', 'probability' => 40],
                    ['name' => 'Negociação', 'color' => '#facc15', 'probability' => 60],
                    ['name' => 'Assinatura', 'color' => '#22c55e', 'probability' => 90],
                    ['name' => 'Ativo', 'color' => '#10b981', 'probability' => 100, 'is_won' => true],
                    ['name' => 'Cancelado', 'color' => '#ef4444', 'probability' => 0, 'is_lost' => true],
                ],
            ],
        ];

        foreach ($pipelines as $pipelineData) {
            $stages = $pipelineData['stages'];
            unset($pipelineData['stages']);

            $existing = CrmPipeline::where('tenant_id', $tenantId)
                ->where('slug', $pipelineData['slug'])
                ->first();

            if ($existing) continue;

            $pipeline = CrmPipeline::create(array_merge($pipelineData, [
                'tenant_id' => $tenantId,
            ]));

            foreach ($stages as $i => $stage) {
                $pipeline->stages()->create([
                    'tenant_id' => $tenantId,
                    'name' => $stage['name'],
                    'color' => $stage['color'],
                    'sort_order' => $i,
                    'probability' => $stage['probability'],
                    'is_won' => $stage['is_won'] ?? false,
                    'is_lost' => $stage['is_lost'] ?? false,
                ]);
            }
        }
    }
}
