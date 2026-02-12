<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DatabaseSeederCentralPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_operational_roles_receive_central_permissions_on_seed(): void
    {
        $this->seed(DatabaseSeeder::class);

        setPermissionsTeamId(null);

        $manager = Role::where('name', 'gerente')->firstOrFail();
        $technician = Role::where('name', 'tecnico')->firstOrFail();
        $finance = Role::where('name', 'financeiro')->firstOrFail();

        $this->assertTrue($manager->hasPermissionTo('central.item.view'));
        $this->assertTrue($manager->hasPermissionTo('central.create.task'));
        $this->assertTrue($manager->hasPermissionTo('central.assign'));
        $this->assertTrue($manager->hasPermissionTo('central.manage.kpis'));
        $this->assertTrue($manager->hasPermissionTo('central.manage.rules'));

        $this->assertTrue($technician->hasPermissionTo('central.item.view'));
        $this->assertTrue($technician->hasPermissionTo('central.create.task'));
        $this->assertTrue($technician->hasPermissionTo('central.close.self'));

        $this->assertTrue($finance->hasPermissionTo('central.item.view'));
        $this->assertTrue($finance->hasPermissionTo('central.manage.kpis'));
        $this->assertTrue($finance->hasPermissionTo('central.manage.rules'));
    }
}
