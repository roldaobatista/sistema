<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

$tenant = Tenant::firstOrCreate(
    ['document' => '00.000.000/0001-00'],
    ['name' => 'Empresa Principal', 'email' => 'contato@empresa.local', 'status' => 'active']
);
Branch::firstOrCreate(
    ['tenant_id' => $tenant->id, 'code' => 'MTZ'],
    ['name' => 'Matriz', 'address_city' => null, 'address_state' => null]
);
$role = \App\Models\Role::firstOrCreate(
    ['name' => 'super_admin', 'guard_name' => 'web'],
    ['display_name' => 'Super Administrador', 'description' => 'Acesso total', 'tenant_id' => null]
);
$allPerms = \Spatie\Permission\Models\Permission::where('guard_name', 'web')->pluck('name');
$role->syncPermissions($allPerms);
$user = User::firstOrCreate(
    ['email' => 'admin@sistema.local'],
    [
        'name' => 'Administrador',
        'password' => Hash::make('password'),
        'is_active' => true,
        'tenant_id' => $tenant->id,
        'current_tenant_id' => $tenant->id,
    ]
);
DB::table('users')->where('id', $user->id)->update(['password' => Hash::make('password')]);
$user->assignRole($role);
$user->tenants()->syncWithoutDetaching([$tenant->id => ['is_default' => true]]);
echo "OK - admin@sistema.local / password\n";
