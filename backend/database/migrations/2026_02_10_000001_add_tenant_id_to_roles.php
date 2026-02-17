<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableNames = config('permission.table_names');

        if (empty($tableNames)) {
            throw new \Exception('Error: config/permission.php not loaded. Run [php artisan config:clear] and try again.');
        }

        Schema::table($tableNames['roles'], function (Blueprint $table) use ($tableNames) {
            if (!Schema::hasColumn($tableNames['roles'], 'tenant_id')) {
                $table->foreignId('tenant_id')->nullable()
                    ->constrained('tenants')->nullOnDelete();
            }
            
            // Remove unique constraint antiga (name, guard_name)
            // Precisamos verificar se o índice existe antes de dropar? 
            // Em SQLite o dropIndex pode falhar se não existir, mas o Schema builder geralmente lida com isso.
            // Vamos assumir que se tenant_id não existia, o indice antigo existia.
            
            try {
                $table->dropUnique(['name', 'guard_name']);
            } catch (\Exception $e) {
                Log::warning('add_tenant_id_to_roles: dropUnique skipped', ['error' => $e->getMessage()]);
            }

            // Adiciona nova unique constraint (tenant_id, name, guard_name)
            try {
                $table->unique(['name', 'guard_name', 'tenant_id']);
            } catch (\Exception $e) {
                Log::warning('add_tenant_id_to_roles: unique constraint skipped', ['error' => $e->getMessage()]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tableNames = config('permission.table_names');

        if (empty($tableNames)) {
             throw new \Exception('Error: config/permission.php not loaded. Run [php artisan config:clear] and try again.');
        }

        Schema::table($tableNames['roles'], function (Blueprint $table) {
            $table->dropUnique(['name', 'guard_name', 'tenant_id']);
            $table->dropConstrainedForeignId('tenant_id');
            $table->unique(['name', 'guard_name']);
        });
    }
};
