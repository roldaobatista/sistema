<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * HR Advanced Module — Permissions for Wave 1+2 features.
 */
return new class extends Migration
{
    private array $permissions = [
        // Clock Approval (extends hr.clock.view, hr.clock.manage from batch3)
        'hr.clock.approve',

        // Geofences
        'hr.geofence.view', 'hr.geofence.manage',

        // Time Clock Adjustments
        'hr.adjustment.view', 'hr.adjustment.create', 'hr.adjustment.approve',

        // Journey Rules & Hour Bank
        'hr.journey.view', 'hr.journey.manage',

        // Holidays
        'hr.holiday.view', 'hr.holiday.manage',

        // Leave Requests & Vacations (Wave 2)
        'hr.leave.view', 'hr.leave.create', 'hr.leave.approve',

        // Employee Documents (Wave 2)
        'hr.document.view', 'hr.document.manage',

        // Onboarding (Wave 2)
        'hr.onboarding.view', 'hr.onboarding.manage',

        // Advanced Dashboard
        'hr.dashboard.view',
    ];

    public function up(): void
    {
        $guard = 'web';
        $now = now();

        foreach ($this->permissions as $perm) {
            DB::table('permissions')->insertOrIgnore([
                'name' => $perm,
                'guard_name' => $guard,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Auto-assign to super_admin
        $superAdminRole = DB::table('roles')->where('name', 'super_admin')->first();
        if ($superAdminRole) {
            $permIds = DB::table('permissions')
                ->whereIn('name', $this->permissions)
                ->pluck('id');

            foreach ($permIds as $permId) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $permId,
                    'role_id' => $superAdminRole->id,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('name', $this->permissions)->delete();
    }
};
