<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Branch;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Criar permissões, roles e dados base do sistema
        $this->call([
            PermissionsSeeder::class,
            CameraSeeder::class,
        ]);

        // ─── TENANT 1 ─── Calibrações Brasil ──────────────────
        $t1 = Tenant::create([
            'name' => 'Calibrações Brasil',
            'document' => '12.345.678/0001-90',
            'email' => 'contato@calibracoes.com.br',
            'phone' => '(11) 3000-0001',
            'status' => 'active',
        ]);
        Branch::create(['tenant_id' => $t1->id, 'name' => 'Matriz SP', 'code' => 'MTZ', 'address_city' => 'São Paulo', 'address_state' => 'SP']);
        Branch::create(['tenant_id' => $t1->id, 'name' => 'Filial RJ', 'code' => 'FRJ', 'address_city' => 'Rio de Janeiro', 'address_state' => 'RJ']);

        // ─── TENANT 2 ─── TechAssist ──────────────────
        $t2 = Tenant::create([
            'name' => 'TechAssist Serviços',
            'document' => '98.765.432/0001-10',
            'email' => 'contato@techassist.com.br',
            'phone' => '(21) 4000-0002',
            'status' => 'active',
        ]);
        Branch::create(['tenant_id' => $t2->id, 'name' => 'Sede Central', 'code' => 'SED', 'address_city' => 'Campinas', 'address_state' => 'SP']);

        // ─── TENANT 3 ─── MedEquip ──────────────────
        $t3 = Tenant::create([
            'name' => 'MedEquip Metrologia',
            'document' => '11.222.333/0001-44',
            'email' => 'contato@medequip.com.br',
            'phone' => '(31) 5000-0003',
            'status' => 'active',
        ]);
        Branch::create(['tenant_id' => $t3->id, 'name' => 'Laboratório BH', 'code' => 'LBH', 'address_city' => 'Belo Horizonte', 'address_state' => 'MG']);

        // 3. Seeders que dependem de tenants existentes
        $this->call([
            ExpenseCategorySeeder::class,
            LookupSeeder::class,
        ]);

        // 4. Buscar roles criados pelo PermissionsSeeder
        $superAdmin = Role::where('name', 'super_admin')->first();
        $admin = Role::where('name', 'admin')->first();
        $manager = Role::where('name', 'gerente')->first();
        $technician = Role::where('name', 'tecnico')->first();
        $receptionist = Role::where('name', 'atendimento')->first();
        $seller = Role::where('name', 'comercial')->first();
        $driver = Role::firstOrCreate(['name' => 'motorista', 'guard_name' => 'web'], ['display_name' => 'Motorista']);
        $financeiro = Role::where('name', 'financeiro')->first();
        $coordenador = Role::where('name', 'coordenador')->first();
        $estoquista = Role::where('name', 'estoquista')->first();

        // Permissões já foram atribuídas pelo PermissionsSeeder.
        // Aqui apenas atribuímos permissões extras para o motorista (role adicional não coberto pelo seeder).
        if ($driver && !$driver->permissions()->exists()) {
            $driver->givePermissionTo([
                'os.work_order.view',
                'technicians.time_entry.create', 'technicians.time_entry.view',
                'expenses.expense.create', 'expenses.expense.view',
                'expenses.fueling_log.view', 'expenses.fueling_log.create',
                'notifications.notification.view', 'notifications.notification.update',
            ]);
        }

        // ── Usuários ──────────────────

        // Super Admin (acesso a todas as empresas)
        $sa = $this->createUser('Administrador', 'admin@sistema.local', $t1, $superAdmin);
        $sa->tenants()->attach([$t2->id, $t3->id]);

        // Tenant 1 — Calibrações Brasil
        $this->createUser('Carlos Gerente', 'carlos@calibracoes.com.br', $t1, $manager);
        $this->createUser('Roberto Silva', 'roberto@calibracoes.com.br', $t1, $technician);
        $this->createUser('Anderson Costa', 'anderson@calibracoes.com.br', $t1, $technician);
        $this->createUser('Fernando Lima', 'fernando@calibracoes.com.br', $t1, $technician);
        $this->createUser('Juliana Souza', 'juliana@calibracoes.com.br', $t1, $receptionist ?? $admin);
        $this->createUser('Marcos Vendas', 'marcos@calibracoes.com.br', $t1, $seller ?? $admin);
        $this->createUser('José Motorista', 'jose@calibracoes.com.br', $t1, $driver ?? $admin);
        $this->createUser('Ana Financeiro', 'ana@calibracoes.com.br', $t1, $financeiro ?? $admin);

        // Tenant 2 — TechAssist
        $this->createUser('Paulo Admin', 'paulo@techassist.com.br', $t2, $admin);
        $this->createUser('Ricardo Técnico', 'ricardo@techassist.com.br', $t2, $technician);
        $this->createUser('Luciana Atendente', 'luciana@techassist.com.br', $t2, $receptionist);

        // Tenant 3 — MedEquip
        $this->createUser('Maria Admin', 'maria@medequip.com.br', $t3, $admin);
        $this->createUser('Pedro Técnico', 'pedro@medequip.com.br', $t3, $technician);

        // ── Clientes de exemplo (Tenant 1) ──────────────
        $customers = [];
        $customerData = [
            ['name' => 'Supermercado Bom Preço', 'document' => '12.345.678/0001-01', 'type' => 'PJ', 'phone' => '(11) 3333-1001', 'address_city' => 'São Paulo', 'address_state' => 'SP'],
            ['name' => 'Farmácia Popular Center', 'document' => '23.456.789/0001-02', 'type' => 'PJ', 'phone' => '(11) 3333-1002', 'address_city' => 'Guarulhos', 'address_state' => 'SP'],
            ['name' => 'Indústria Metalúrgica Forte', 'document' => '34.567.890/0001-03', 'type' => 'PJ', 'phone' => '(11) 3333-1003', 'address_city' => 'Osasco', 'address_state' => 'SP'],
            ['name' => 'Padaria Pão Dourado', 'document' => '45.678.901/0001-04', 'type' => 'PJ', 'phone' => '(11) 3333-1004', 'address_city' => 'Santo André', 'address_state' => 'SP'],
        ];
        foreach ($customerData as $c) {
            $customers[] = \App\Models\Customer::create(array_merge($c, ['tenant_id' => $t1->id, 'is_active' => true]));
        }

        // ── Equipamentos de exemplo (Tenant 1) ──────────
        $equipments = [
            ['customer_id' => $customers[0]->id, 'code' => 'EQP-00001', 'type' => 'Balança', 'category' => 'balanca_plataforma', 'brand' => 'Toledo', 'manufacturer' => 'Toledo do Brasil', 'model' => 'Prix 3 Plus', 'serial_number' => 'TLD-2024-001', 'capacity' => 30, 'capacity_unit' => 'kg', 'resolution' => 0.005, 'precision_class' => 'III', 'status' => 'ativo', 'location' => 'Setor Hortifruti', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(11), 'next_calibration_at' => now()->addMonths(1), 'is_critical' => true, 'is_active' => true],
            ['customer_id' => $customers[0]->id, 'code' => 'EQP-00002', 'type' => 'Balança', 'category' => 'balanca_contadora', 'brand' => 'Toledo', 'model' => 'Prix 4 Uno', 'serial_number' => 'TLD-2024-002', 'capacity' => 15, 'capacity_unit' => 'kg', 'resolution' => 0.005, 'precision_class' => 'III', 'status' => 'ativo', 'location' => 'Padaria', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(14), 'next_calibration_at' => now()->subMonths(2), 'is_critical' => false, 'is_active' => true],
            ['customer_id' => $customers[1]->id, 'code' => 'EQP-00003', 'type' => 'Balança', 'category' => 'balanca_analitica', 'brand' => 'Shimadzu', 'manufacturer' => 'Shimadzu Corp', 'model' => 'AUW220D', 'serial_number' => 'SHM-2023-101', 'capacity' => 0.220, 'capacity_unit' => 'kg', 'resolution' => 0.0001, 'precision_class' => 'I', 'status' => 'ativo', 'location' => 'Laboratório QC', 'calibration_interval_months' => 6, 'last_calibration_at' => now()->subMonths(5), 'next_calibration_at' => now()->addDays(12), 'is_critical' => true, 'is_active' => true, 'inmetro_number' => 'INMETRO-2023-5544'],
            ['customer_id' => $customers[2]->id, 'code' => 'EQP-00004', 'type' => 'Balança', 'category' => 'balanca_plataforma', 'brand' => 'Filizola', 'manufacturer' => 'Filizola', 'model' => 'ID-M 150', 'serial_number' => 'FLZ-2022-050', 'capacity' => 150, 'capacity_unit' => 'kg', 'resolution' => 0.05, 'precision_class' => 'III', 'status' => 'ativo', 'location' => 'Expedição', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(10), 'next_calibration_at' => now()->addMonths(2), 'is_critical' => false, 'is_active' => true],
            ['customer_id' => $customers[2]->id, 'code' => 'EQP-00005', 'type' => 'Balança', 'category' => 'balanca_rodoviaria', 'brand' => 'Toledo', 'manufacturer' => 'Toledo do Brasil', 'model' => 'Conquista 2040', 'serial_number' => 'TLD-2021-900', 'capacity' => 60000, 'capacity_unit' => 'kg', 'resolution' => 20, 'precision_class' => 'IIII', 'status' => 'em_manutencao', 'location' => 'Portaria', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(6), 'next_calibration_at' => now()->addMonths(6), 'is_critical' => true, 'is_active' => true],
            ['customer_id' => $customers[3]->id, 'code' => 'EQP-00006', 'type' => 'Balança', 'category' => 'balanca_precisao', 'brand' => 'Marte', 'manufacturer' => 'Marte Científica', 'model' => 'AD3300', 'serial_number' => 'MRT-2024-077', 'capacity' => 3.3, 'capacity_unit' => 'kg', 'resolution' => 0.01, 'precision_class' => 'II', 'status' => 'ativo', 'location' => 'Balcão', 'calibration_interval_months' => 12, 'last_calibration_at' => now()->subMonths(13), 'next_calibration_at' => now()->subDays(5), 'is_critical' => false, 'is_active' => true],
        ];
        foreach ($equipments as $eq) {
            \App\Models\Equipment::create(array_merge($eq, ['tenant_id' => $t1->id]));
        }
    }

    private function createUser(string $name, string $email, Tenant $tenant, Role $role): User
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => 'password',
            'is_active' => true,
            'tenant_id' => $tenant->id,
            'current_tenant_id' => $tenant->id,
        ]);
        $user->assignRole($role);
        $user->tenants()->attach($tenant->id, ['is_default' => true]);
        return $user;
    }

}
