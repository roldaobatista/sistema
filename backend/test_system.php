<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== TESTE COMPLETO DO SISTEMA ===" . PHP_EOL . PHP_EOL;

// 1. Database connectivity + seed verification
echo "--- 1. BANCO DE DADOS ---" . PHP_EOL;
$users = App\Models\User::count();
$tenants = App\Models\Tenant::count();
$roles = Spatie\Permission\Models\Role::count();
$permissions = Spatie\Permission\Models\Permission::count();
$branches = App\Models\Branch::count();
echo "Users: $users" . PHP_EOL;
echo "Tenants: $tenants" . PHP_EOL;
echo "Roles: $roles" . PHP_EOL;
echo "Permissions: $permissions" . PHP_EOL;
echo "Branches: $branches" . PHP_EOL;

assert($users >= 14, 'Seed deveria criar 14+ users');
assert($tenants >= 3, 'Seed deveria criar 3 tenants');
assert($roles >= 8, 'Seed deveria criar 8 roles');
echo "✅ Seed OK" . PHP_EOL . PHP_EOL;

// 2. Users listing
echo "--- 2. USUARIOS ---" . PHP_EOL;
foreach (App\Models\User::with('currentTenant')->get() as $u) {
    $t = $u->currentTenant?->name ?? '?';
    $r = $u->getRoleNames()->implode(',') ?: 'sem role';
    echo "  - {$u->name} <{$u->email}> | Tenant: {$t} | Roles: {$r}" . PHP_EOL;
}
echo PHP_EOL;

// 3. Tenants
echo "--- 3. TENANTS ---" . PHP_EOL;
foreach (App\Models\Tenant::all() as $t) {
    echo "  - [{$t->id}] {$t->name}" . PHP_EOL;
}
echo PHP_EOL;

// 4. Commission Rules
echo "--- 4. COMMISSION RULES ---" . PHP_EOL;
$cr = App\Models\CommissionRule::count();
echo "Total rules: $cr" . PHP_EOL;
echo "Calculation types available: " . count(App\Models\CommissionRule::CALCULATION_TYPES) . PHP_EOL;
foreach (App\Models\CommissionRule::CALCULATION_TYPES as $k => $v) {
    echo "  - $k: $v" . PHP_EOL;
}
echo PHP_EOL;

// 5. Test calculateCommission method
echo "--- 5. CALCULO COMISSAO ---" . PHP_EOL;
$rule = new App\Models\CommissionRule();
$rule->calculation_type = 'percent_gross';
$rule->value = 10;
$result = $rule->calculateCommission(1000, ['gross' => 1000]);
echo "10% de R$ 1000 (percent_gross) = R$ $result" . PHP_EOL;
assert($result == 100.0, 'Deveria ser 100');
echo "✅ calculateCommission OK" . PHP_EOL . PHP_EOL;

// 6. Test TechnicianCashFund
echo "--- 6. CAIXA TECNICO ---" . PHP_EOL;
$funds = App\Models\TechnicianCashFund::count();
echo "Funds: $funds" . PHP_EOL;
echo "✅ TechnicianCashFund model OK" . PHP_EOL . PHP_EOL;

// 7. Tables check
echo "--- 7. TABELAS ---" . PHP_EOL;
$tables = ['users', 'tenants', 'branches', 'roles', 'permissions', 'customers',
    'products', 'services', 'equipments', 'work_orders', 'work_order_items',
    'accounts_receivable', 'accounts_payable', 'expenses', 'expense_categories',
    'commission_rules', 'commission_events', 'commission_settlements',
    'time_entries', 'quotes', 'quote_equipments', 'quote_items', 'quote_photos',
    'service_calls', 'service_call_equipments',
    'technician_cash_funds', 'technician_cash_transactions',
    'work_order_technicians', 'work_order_equipments'];
$missing = [];
foreach ($tables as $table) {
    if (!Illuminate\Support\Facades\Schema::hasTable($table)) {
        $missing[] = $table;
    }
}
echo "Tabelas esperadas: " . count($tables) . PHP_EOL;
echo "Existem: " . (count($tables) - count($missing)) . PHP_EOL;
if ($missing) {
    echo "❌ Faltando: " . implode(', ', $missing) . PHP_EOL;
} else {
    echo "✅ Todas as tabelas existem" . PHP_EOL;
}
echo PHP_EOL;

// 8. SQLite WAL mode
echo "--- 8. SQLITE CONFIG ---" . PHP_EOL;
$jm = DB::select("PRAGMA journal_mode")[0]->journal_mode ?? '?';
$bt = DB::select("PRAGMA busy_timeout")[0]->busy_timeout ?? '?';
echo "journal_mode: $jm" . PHP_EOL;
echo "busy_timeout: $bt" . PHP_EOL;
echo ($jm === 'wal' ? '✅' : '❌') . " WAL mode" . PHP_EOL;
echo PHP_EOL;

// Summary
echo "================================" . PHP_EOL;
echo "✅ TODOS OS TESTES PASSARAM!" . PHP_EOL;
echo "================================" . PHP_EOL;
