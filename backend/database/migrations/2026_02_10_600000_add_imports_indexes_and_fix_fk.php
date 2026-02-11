<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        // SQLite não suporta SHOW INDEX / information_schema
        if ($driver === 'sqlite') {
            return;
        }

        // Verificar índices existentes
        $existingIndexes = collect(DB::select("SHOW INDEX FROM imports"))->pluck('Key_name')->unique()->toArray();

        Schema::table('imports', function (Blueprint $t) use ($existingIndexes) {
            if (!in_array('imports_status_index', $existingIndexes)) {
                $t->index('status');
            }
            if (!in_array('imports_user_id_index', $existingIndexes)) {
                $t->index('user_id');
            }
        });

        // Atualizar FK para cascadeOnDelete
        $existingFks = collect(DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME = 'imports' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        ))->pluck('CONSTRAINT_NAME')->map(fn($n) => strtolower($n))->toArray();

        Schema::table('imports', function (Blueprint $t) use ($existingFks) {
            if (in_array('imports_user_id_foreign', $existingFks)) {
                $t->dropForeign(['user_id']);
            }
            $t->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            return;
        }

        Schema::table('imports', function (Blueprint $t) {
            $t->dropIndex(['status']);
            $t->dropIndex(['user_id']);

            $t->dropForeign(['user_id']);
            $t->foreign('user_id')
                ->references('id')
                ->on('users');
        });
    }
};
