<?php

use App\Models\User;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    DB::beginTransaction();

    echo "Creating Tenant...\n";
    $tenant = Tenant::factory()->create();
    
    echo "Creating User...\n";
    $user = User::factory()->create([
        'tenant_id' => $tenant->id,
        'current_tenant_id' => $tenant->id,
    ]);
    $user->tenants()->attach($tenant->id, ['is_default' => true]);

    echo "User created: {$user->id}\n";
    
    // Simulate the destroy method logic
    echo "Attempting delete...\n";
    
    // 1. Resolve tenant user (simplified)
    // 2. Dependency check (skipped for fresh user)
    
    // 3. Transaction
    DB::transaction(function () use ($user) {
        echo "Deleting tokens...\n";
        $user->tokens()->delete();
        
        echo "Detaching tenants...\n";
        $user->tenants()->detach();
        
        echo "Deleting user...\n";
        $user->delete();
    });

    echo "Delete successful!\n";
    DB::rollBack(); // Don't keep garbage

} catch (\Exception $e) {
    echo "CAUGHT EXCEPTION:\n";
    echo $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    DB::rollBack();
}
