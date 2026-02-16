<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ExpenseCategory;
use App\Models\Tenant;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Combustível',                'color' => '#ef4444', 'default_affects_net_value' => true,  'default_affects_technician_cash' => true],
            ['name' => 'Alimentação / Refeição',     'color' => '#f97316', 'default_affects_net_value' => false, 'default_affects_technician_cash' => true],
            ['name' => 'Peças / Materiais (compra)', 'color' => '#3b82f6', 'default_affects_net_value' => true,  'default_affects_technician_cash' => true],
            ['name' => 'Pedágio',                    'color' => '#8b5cf6', 'default_affects_net_value' => true,  'default_affects_technician_cash' => true],
            ['name' => 'Hospedagem',                 'color' => '#06b6d4', 'default_affects_net_value' => false, 'default_affects_technician_cash' => true],
            ['name' => 'Ferramentas',                'color' => '#84cc16', 'default_affects_net_value' => false, 'default_affects_technician_cash' => true],
            ['name' => 'Material de Escritório',     'color' => '#6b7280', 'default_affects_net_value' => false, 'default_affects_technician_cash' => false],
            ['name' => 'Manutenção de Veículo',      'color' => '#eab308', 'default_affects_net_value' => false, 'default_affects_technician_cash' => false],
            ['name' => 'Estacionamento',             'color' => '#a855f7', 'default_affects_net_value' => true,  'default_affects_technician_cash' => true],
            ['name' => 'Outros',                     'color' => '#64748b', 'default_affects_net_value' => false, 'default_affects_technician_cash' => false],
        ];

        $tenants = Tenant::all();

        if ($tenants->isEmpty()) {
            $this->command->warn('⚠️  Nenhum tenant encontrado. Criando categorias sem tenant_id (fallback).');
            foreach ($categories as $cat) {
                ExpenseCategory::withoutGlobalScopes()->updateOrCreate(
                    ['name' => $cat['name'], 'tenant_id' => null],
                    array_merge($cat, ['active' => true])
                );
            }
        } else {
            foreach ($tenants as $tenant) {
                foreach ($categories as $cat) {
                    ExpenseCategory::withoutGlobalScopes()->updateOrCreate(
                        ['tenant_id' => $tenant->id, 'name' => $cat['name']],
                        array_merge($cat, ['active' => true])
                    );
                }
            }
        }

        $this->command->info('✅ ' . count($categories) . ' categorias de despesa criadas/verificadas para ' . $tenants->count() . ' tenant(s)');
    }
}
