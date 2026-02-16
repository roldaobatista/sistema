<?php

namespace Database\Seeders;

use App\Models\CrmLossReason;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class CrmFeaturesSeeder extends Seeder
{
    public function run(): void
    {
        Tenant::all()->each(function (Tenant $tenant) {
            $this->seedLossReasons($tenant);
            $this->seedDefaultScoringRules($tenant);
        });
    }

    private function seedLossReasons(Tenant $tenant): void
    {
        if (CrmLossReason::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $reasons = [
            ['name' => 'Preço alto', 'category' => 'price', 'sort_order' => 1],
            ['name' => 'Concorrente com melhor oferta', 'category' => 'competitor', 'sort_order' => 2],
            ['name' => 'Prazo de entrega', 'category' => 'timing', 'sort_order' => 3],
            ['name' => 'Não atende especificação técnica', 'category' => 'product_fit', 'sort_order' => 4],
            ['name' => 'Cliente sem orçamento no momento', 'category' => 'budget', 'sort_order' => 5],
            ['name' => 'Perda de contato com decisor', 'category' => 'relationship', 'sort_order' => 6],
            ['name' => 'Cliente optou por não calibrar', 'category' => 'other', 'sort_order' => 7],
            ['name' => 'Projeto cancelado pelo cliente', 'category' => 'other', 'sort_order' => 8],
            ['name' => 'Mudança de fornecedor interno', 'category' => 'competitor', 'sort_order' => 9],
            ['name' => 'Outro motivo', 'category' => 'other', 'sort_order' => 10],
        ];

        foreach ($reasons as $reason) {
            CrmLossReason::create([...$reason, 'tenant_id' => $tenant->id]);
        }
    }

    private function seedDefaultScoringRules(Tenant $tenant): void
    {
        if (\App\Models\CrmLeadScoringRule::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $rules = [
            ['name' => 'Empresa grande (>50 equip.)', 'field' => 'company_size', 'operator' => 'equals', 'value' => 'grande', 'points' => 30, 'category' => 'firmographic', 'sort_order' => 1],
            ['name' => 'Empresa média (11-50 equip.)', 'field' => 'company_size', 'operator' => 'equals', 'value' => 'media', 'points' => 20, 'category' => 'firmographic', 'sort_order' => 2],
            ['name' => 'Tem contrato ativo', 'field' => 'contract_type', 'operator' => 'not_equals', 'value' => 'avulso', 'points' => 25, 'category' => 'behavioral', 'sort_order' => 3],
            ['name' => 'Health Score > 70', 'field' => 'health_score', 'operator' => 'greater_than', 'value' => '70', 'points' => 15, 'category' => 'engagement', 'sort_order' => 4],
            ['name' => 'Sem contato > 90 dias', 'field' => 'days_since_contact', 'operator' => 'greater_than', 'value' => '90', 'points' => -20, 'category' => 'engagement', 'sort_order' => 5],
            ['name' => 'Segmento: Indústria', 'field' => 'segment', 'operator' => 'equals', 'value' => 'industria', 'points' => 15, 'category' => 'firmographic', 'sort_order' => 6],
            ['name' => 'Receita anual > R$ 100k', 'field' => 'annual_revenue_estimate', 'operator' => 'greater_than', 'value' => '100000', 'points' => 20, 'category' => 'firmographic', 'sort_order' => 7],
            ['name' => 'Rating 5 estrelas', 'field' => 'rating', 'operator' => 'equals', 'value' => '5', 'points' => 10, 'category' => 'engagement', 'sort_order' => 8],
        ];

        foreach ($rules as $rule) {
            \App\Models\CrmLeadScoringRule::create([...$rule, 'tenant_id' => $tenant->id]);
        }
    }
}
