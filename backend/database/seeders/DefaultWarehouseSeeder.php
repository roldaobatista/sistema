<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tenant;
use App\Models\Warehouse;

class DefaultWarehouseSeeder extends Seeder
{
    public function run(): void
    {
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            Warehouse::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'code' => 'CENTRAL',
                ],
                [
                    'name' => 'Depósito Central',
                    'type' => 'fixed',
                    'is_active' => true,
                ]
            );
        }
    }
}
