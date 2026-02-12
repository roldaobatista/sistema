<?php

use App\Models\PermissionGroup;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        if (!\Schema::hasTable('permissions')) {
            return;
        }

        $group = PermissionGroup::query()->firstOrCreate(
            ['name' => 'Inmetro'],
            ['order' => 999]
        );

        $permissions = [
            'inmetro.intelligence.view' => 'LOW',
            'inmetro.intelligence.import' => 'MED',
            'inmetro.intelligence.enrich' => 'MED',
            'inmetro.intelligence.convert' => 'HIGH',
        ];

        foreach ($permissions as $name => $criticality) {
            Permission::query()->firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                ['group_id' => $group->id, 'criticality' => $criticality]
            );
        }
    }

    public function down(): void
    {
        if (!\Schema::hasTable('permissions')) {
            return;
        }

        Permission::query()
            ->whereIn('name', [
                'inmetro.intelligence.view',
                'inmetro.intelligence.import',
                'inmetro.intelligence.enrich',
                'inmetro.intelligence.convert',
            ])
            ->delete();
    }
};
