<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FIX-03: A constraint unique(tenant_id, code) é incompatível com code nullable.
 * Removemos a constraint de banco e confiamos na validação da aplicação.
 */
return new class extends Migration {
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver !== 'sqlite') {
            $fkName = $this->findForeignKeyName('branches', 'tenant_id');

            if ($fkName) {
                DB::statement("ALTER TABLE `branches` DROP FOREIGN KEY `{$fkName}`");
            }

            Schema::table('branches', function (Blueprint $table) {
                $table->dropUnique(['tenant_id', 'code']);
                $table->index(['tenant_id', 'code'], 'branches_tenant_code_index');
                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            });
        } else {
            Schema::table('branches', function (Blueprint $table) {
                $table->dropUnique(['tenant_id', 'code']);
                $table->index(['tenant_id', 'code'], 'branches_tenant_code_index');
            });
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        Schema::table('branches', function (Blueprint $table) use ($driver) {
            $table->dropIndex('branches_tenant_code_index');
            if ($driver !== 'sqlite') {
                $table->dropForeign(['tenant_id']);
            }
            $table->unique(['tenant_id', 'code']);
            if ($driver !== 'sqlite') {
                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            }
        });
    }

    private function findForeignKeyName(string $table, string $column): ?string
    {
        $database = DB::getDatabaseName();
        $results = DB::select("
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
              AND REFERENCED_TABLE_NAME IS NOT NULL
            LIMIT 1
        ", [$database, $table, $column]);

        return $results[0]->CONSTRAINT_NAME ?? null;
    }
};
