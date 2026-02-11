<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
                $table->foreignId('tenant_id')->nullable()->after('guard_name')
                    ->constrained('tenants')->nullOnDelete();
            }
            
            // Remove unique constraint antiga (name, guard_name)
            // Precisamos verificar se o índice existe antes de dropar? 
            // Em SQLite o dropIndex pode falhar se não existir, mas o Schema builder geralmente lida com isso.
            // Vamos assumir que se tenant_id não existia, o indice antigo existia.
            
            try {
                $table->dropUnique(['name', 'guard_name']);
            } catch (\Exception $e) {
                // Índice pode já ter sido removido ou não existir
            }
            
            // Adiciona nova unique constraint (tenant_id, name, guard_name)
            // Permitindo múltiplos NULLs no tenant_id para roles globais
            try {
                $table->unique(['name', 'guard_name', 'tenant_id']);
            } catch (\Exception $e) {
                // Índice pode já existir
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
