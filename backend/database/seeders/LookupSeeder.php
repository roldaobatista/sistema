<?php

namespace Database\Seeders;

use App\Models\Lookups\AccountReceivableCategory;
use App\Models\Lookups\CalibrationType;
use App\Models\Lookups\CancellationReason;
use App\Models\Lookups\ContractType;
use App\Models\Lookups\CustomerSegment;
use App\Models\Lookups\DocumentType;
use App\Models\Lookups\EquipmentCategory;
use App\Models\Lookups\LeadSource;
use App\Models\Lookups\MaintenanceType;
use App\Models\Lookups\MeasurementUnit;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class LookupSeeder extends Seeder
{
    public function run(): void
    {
        $tenants = Tenant::all();

        if ($tenants->isEmpty()) {
            $this->command?->warn('Nenhum tenant encontrado. Criando lookups sem tenant_id.');
            $this->seedForTenant(null);
        } else {
            foreach ($tenants as $tenant) {
                $this->seedForTenant($tenant->id);
            }
        }

        $this->command?->info('Cadastros auxiliares criados/verificados para ' . max(1, $tenants->count()) . ' tenant(s).');
    }

    private function seedForTenant(?int $tenantId): void
    {
        $this->seedLookup(EquipmentCategory::class, $tenantId, [
            ['name' => 'Balança Analítica',       'color' => '#3b82f6'],
            ['name' => 'Balança Semi-Analítica',   'color' => '#6366f1'],
            ['name' => 'Balança de Plataforma',    'color' => '#8b5cf6'],
            ['name' => 'Balança Rodoviária',       'color' => '#a855f7'],
            ['name' => 'Balança Contadora',        'color' => '#06b6d4'],
            ['name' => 'Balança de Precisão',      'color' => '#14b8a6'],
            ['name' => 'Massa Padrão',             'color' => '#f59e0b'],
            ['name' => 'Termômetro',               'color' => '#ef4444'],
            ['name' => 'Paquímetro',               'color' => '#10b981'],
            ['name' => 'Micrômetro',               'color' => '#84cc16'],
            ['name' => 'Manômetro',                'color' => '#f97316'],
            ['name' => 'Outro',                    'color' => '#64748b'],
        ]);

        $this->seedLookup(CustomerSegment::class, $tenantId, [
            ['name' => 'Supermercado',    'color' => '#3b82f6'],
            ['name' => 'Farmácia',        'color' => '#10b981'],
            ['name' => 'Indústria',       'color' => '#6366f1'],
            ['name' => 'Padaria',         'color' => '#f59e0b'],
            ['name' => 'Laboratório',     'color' => '#8b5cf6'],
            ['name' => 'Frigorífico',     'color' => '#06b6d4'],
            ['name' => 'Restaurante',     'color' => '#f97316'],
            ['name' => 'Hospital',        'color' => '#ef4444'],
            ['name' => 'Agronegócio',     'color' => '#84cc16'],
            ['name' => 'Outro',           'color' => '#64748b'],
        ]);

        $this->seedLookup(LeadSource::class, $tenantId, [
            ['name' => 'Indicação',         'color' => '#3b82f6'],
            ['name' => 'Google',            'color' => '#ef4444'],
            ['name' => 'Instagram',         'color' => '#e11d48'],
            ['name' => 'Feira',             'color' => '#f59e0b'],
            ['name' => 'Presença Física',   'color' => '#10b981'],
            ['name' => 'Prospecção',        'color' => '#8b5cf6'],
            ['name' => 'Retorno',           'color' => '#06b6d4'],
            ['name' => 'Contato Direto',    'color' => '#f97316'],
            ['name' => 'Outro',             'color' => '#64748b'],
        ]);

        $this->seedLookup(ContractType::class, $tenantId, [
            ['name' => 'Avulso',            'color' => '#64748b'],
            ['name' => 'Contrato Mensal',   'color' => '#3b82f6'],
            ['name' => 'Contrato Anual',    'color' => '#10b981'],
        ]);

        $this->seedMeasurementUnits($tenantId);

        $this->seedLookup(CalibrationType::class, $tenantId, [
            ['name' => 'Interna',          'color' => '#3b82f6'],
            ['name' => 'Externa',          'color' => '#f59e0b'],
            ['name' => 'Rastreada RBC',    'color' => '#10b981'],
        ]);

        $this->seedLookup(MaintenanceType::class, $tenantId, [
            ['name' => 'Preventiva',  'color' => '#3b82f6'],
            ['name' => 'Corretiva',   'color' => '#ef4444'],
            ['name' => 'Ajuste',      'color' => '#f59e0b'],
            ['name' => 'Limpeza',     'color' => '#10b981'],
        ]);

        $this->seedLookup(DocumentType::class, $tenantId, [
            ['name' => 'Certificado',  'color' => '#3b82f6', 'icon' => 'FileCheck'],
            ['name' => 'Manual',       'color' => '#8b5cf6', 'icon' => 'BookOpen'],
            ['name' => 'Foto',         'color' => '#f59e0b', 'icon' => 'Camera'],
            ['name' => 'Laudo',        'color' => '#10b981', 'icon' => 'FileText'],
            ['name' => 'Relatório',    'color' => '#f97316', 'icon' => 'BarChart3'],
        ]);

        $this->seedLookup(AccountReceivableCategory::class, $tenantId, [
            ['name' => 'Calibração',              'color' => '#3b82f6'],
            ['name' => 'Manutenção',              'color' => '#f59e0b'],
            ['name' => 'Venda de Equipamento',    'color' => '#10b981'],
            ['name' => 'Contrato Recorrente',     'color' => '#8b5cf6'],
            ['name' => 'Consultoria',             'color' => '#06b6d4'],
            ['name' => 'Outros',                  'color' => '#64748b'],
        ]);

        $this->seedCancellationReasons($tenantId);
    }

    private function seedLookup(string $modelClass, ?int $tenantId, array $items): void
    {
        foreach ($items as $i => $item) {
            $modelClass::withoutGlobalScopes()->updateOrCreate(
                ['tenant_id' => $tenantId, 'slug' => Str::slug($item['name'])],
                array_merge($item, [
                    'is_active'  => true,
                    'sort_order' => $i,
                ])
            );
        }
    }

    private function seedMeasurementUnits(?int $tenantId): void
    {
        $units = [
            ['name' => 'Quilograma',  'abbreviation' => 'kg',   'unit_type' => 'peso'],
            ['name' => 'Grama',       'abbreviation' => 'g',    'unit_type' => 'peso'],
            ['name' => 'Miligrama',   'abbreviation' => 'mg',   'unit_type' => 'peso'],
            ['name' => 'Tonelada',    'abbreviation' => 't',    'unit_type' => 'peso'],
            ['name' => 'Unidade',     'abbreviation' => 'un',   'unit_type' => 'quantidade'],
            ['name' => 'Peça',        'abbreviation' => 'pç',   'unit_type' => 'quantidade'],
            ['name' => 'Par',         'abbreviation' => 'par',  'unit_type' => 'quantidade'],
            ['name' => 'Caixa',       'abbreviation' => 'cx',   'unit_type' => 'quantidade'],
            ['name' => 'Pacote',      'abbreviation' => 'pct',  'unit_type' => 'quantidade'],
            ['name' => 'Metro',       'abbreviation' => 'm',    'unit_type' => 'comprimento'],
            ['name' => 'Centímetro',  'abbreviation' => 'cm',   'unit_type' => 'comprimento'],
            ['name' => 'Milímetro',   'abbreviation' => 'mm',   'unit_type' => 'comprimento'],
            ['name' => 'Litro',       'abbreviation' => 'L',    'unit_type' => 'volume'],
            ['name' => 'Mililitro',   'abbreviation' => 'mL',   'unit_type' => 'volume'],
            ['name' => 'Grau Celsius','abbreviation' => '°C',   'unit_type' => 'temperatura'],
            ['name' => 'Rolo',        'abbreviation' => 'rolo', 'unit_type' => 'quantidade'],
        ];

        foreach ($units as $i => $unit) {
            MeasurementUnit::withoutGlobalScopes()->updateOrCreate(
                ['tenant_id' => $tenantId, 'slug' => Str::slug($unit['name'])],
                array_merge($unit, [
                    'is_active'  => true,
                    'sort_order' => $i,
                    'color'      => '#64748b',
                ])
            );
        }
    }

    private function seedCancellationReasons(?int $tenantId): void
    {
        $reasons = [
            ['name' => 'Cliente Desistiu',       'applies_to' => ['os', 'chamado', 'orcamento'], 'color' => '#ef4444'],
            ['name' => 'Preço Elevado',          'applies_to' => ['orcamento'],                  'color' => '#f59e0b'],
            ['name' => 'Prazo Inviável',         'applies_to' => ['os', 'orcamento'],            'color' => '#f97316'],
            ['name' => 'Concorrência',           'applies_to' => ['orcamento'],                  'color' => '#8b5cf6'],
            ['name' => 'Equipamento Descartado', 'applies_to' => ['os', 'chamado'],              'color' => '#64748b'],
            ['name' => 'Duplicidade',            'applies_to' => ['os', 'chamado', 'orcamento'], 'color' => '#06b6d4'],
            ['name' => 'Outro',                  'applies_to' => ['os', 'chamado', 'orcamento'], 'color' => '#64748b'],
        ];

        foreach ($reasons as $i => $reason) {
            CancellationReason::withoutGlobalScopes()->updateOrCreate(
                ['tenant_id' => $tenantId, 'slug' => Str::slug($reason['name'])],
                array_merge($reason, [
                    'is_active'  => true,
                    'sort_order' => $i,
                ])
            );
        }
    }
}
