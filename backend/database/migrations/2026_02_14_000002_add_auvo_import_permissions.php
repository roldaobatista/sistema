<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration {
    public function up(): void
    {
        // Permissions are now managed by PermissionsSeeder with correct granular names.
        // This migration is kept as a no-op for migration history consistency.

        // Clean up old incorrect permission names if they exist
        Permission::where('name', 'auvo.import.manage')->delete();
        Permission::where('name', 'auvo.export')->delete();
        Permission::where('name', 'auvo.import')->delete();
    }

    public function down(): void
    {
        // No-op — permissions managed by seeder
    }
};
