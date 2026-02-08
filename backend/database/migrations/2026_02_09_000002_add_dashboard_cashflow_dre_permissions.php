<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // Buscar group_ids
        $platformGroupId = DB::table('permission_groups')->where('name', 'Platform')->value('id');
        $financeGroupId = DB::table('permission_groups')->where('name', 'Finance')->value('id');

        // Inserir permissões
        $perms = [
            ['name' => 'platform.dashboard.view', 'guard_name' => 'web', 'group_id' => $platformGroupId, 'criticality' => 'LOW', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'finance.cashflow.view', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'LOW', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'finance.dre.view', 'guard_name' => 'web', 'group_id' => $financeGroupId, 'criticality' => 'LOW', 'created_at' => $now, 'updated_at' => $now],
        ];

        foreach ($perms as $perm) {
            DB::table('permissions')->insertOrIgnore($perm);
        }

        // Atribuir aos roles: admin, gerente, financeiro, super_admin
        $permIds = DB::table('permissions')
            ->whereIn('name', ['platform.dashboard.view', 'finance.cashflow.view', 'finance.dre.view'])
            ->pluck('id');

        $roleIds = DB::table('roles')
            ->whereIn('name', ['super_admin', 'admin', 'gerente', 'financeiro'])
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($permIds as $permId) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $permId,
                    'role_id' => $roleId,
                ]);
            }
        }
    }

    public function down(): void
    {
        $permIds = DB::table('permissions')
            ->whereIn('name', ['platform.dashboard.view', 'finance.cashflow.view', 'finance.dre.view'])
            ->pluck('id');

        DB::table('role_has_permissions')->whereIn('permission_id', $permIds)->delete();
        DB::table('permissions')->whereIn('id', $permIds)->delete();
    }
};
