<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DatabaseSeederServiceCallPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_operational_roles_receive_service_call_permissions_from_seeder(): void
    {
        $this->seed(\Database\Seeders\DatabaseSeeder::class);

        $this->assertRoleHasPermissions('gerente', [
            'service_calls.service_call.view',
            'service_calls.service_call.create',
            'service_calls.service_call.update',
            'service_calls.service_call.assign',
        ]);

        $this->assertRoleHasPermissions('tecnico', [
            'service_calls.service_call.view',
            'service_calls.service_call.update',
        ]);

        $this->assertRoleHasPermissions('atendente', [
            'service_calls.service_call.view',
            'service_calls.service_call.create',
            'service_calls.service_call.update',
        ]);

        $this->assertRoleHasPermissions('vendedor', [
            'service_calls.service_call.view',
            'service_calls.service_call.create',
        ]);
    }

    /**
     * @param array<int, string> $permissions
     */
    private function assertRoleHasPermissions(string $roleName, array $permissions): void
    {
        $role = Role::query()->where('name', $roleName)->where('guard_name', 'web')->firstOrFail();

        foreach ($permissions as $permission) {
            $this->assertTrue(
                $role->hasPermissionTo($permission),
                "Role {$roleName} should have permission {$permission}."
            );
        }
    }
}