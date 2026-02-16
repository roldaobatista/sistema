<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Corrige nomes de roles padronizados de inglês para português.
 * - 'technician' → 'tecnico'
 * - 'seller' → 'vendedor'
 * - 'driver' → 'motorista'
 *
 * Atualiza defaults de colunas e registros existentes.
 */
return new class extends Migration
{
    private array $replacements = [
        'technician' => 'tecnico',
        'seller' => 'vendedor',
        'driver' => 'motorista',
    ];

    public function up(): void
    {
        // 1. Atualizar dados existentes nas tabelas com role como string
        $tables = [
            'commission_event_splits' => 'role',
            'commission_rules' => 'applies_to_role',
            'work_order_technicians' => 'role',
            'commission_campaigns' => 'applies_to_role',
        ];

        foreach ($tables as $table => $column) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
                continue;
            }
            foreach ($this->replacements as $old => $new) {
                DB::table($table)->where($column, $old)->update([$column => $new]);
            }
        }

        // 2. Alterar defaults das colunas
        if (Schema::hasTable('commission_event_splits') && Schema::hasColumn('commission_event_splits', 'role')) {
            DB::statement("ALTER TABLE commission_event_splits ALTER COLUMN role SET DEFAULT 'tecnico'");
        }

        if (Schema::hasTable('commission_rules') && Schema::hasColumn('commission_rules', 'applies_to_role')) {
            DB::statement("ALTER TABLE commission_rules ALTER COLUMN applies_to_role SET DEFAULT 'tecnico'");
        }

        if (Schema::hasTable('work_order_technicians') && Schema::hasColumn('work_order_technicians', 'role')) {
            DB::statement("ALTER TABLE work_order_technicians ALTER COLUMN role SET DEFAULT 'tecnico'");
        }
    }

    public function down(): void
    {
        $tables = [
            'commission_event_splits' => 'role',
            'commission_rules' => 'applies_to_role',
            'work_order_technicians' => 'role',
            'commission_campaigns' => 'applies_to_role',
        ];

        foreach ($tables as $table => $column) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
                continue;
            }
            foreach (array_flip($this->replacements) as $old => $new) {
                DB::table($table)->where($column, $old)->update([$column => $new]);
            }
        }

        if (Schema::hasTable('commission_event_splits') && Schema::hasColumn('commission_event_splits', 'role')) {
            DB::statement("ALTER TABLE commission_event_splits ALTER COLUMN role SET DEFAULT 'technician'");
        }

        if (Schema::hasTable('commission_rules') && Schema::hasColumn('commission_rules', 'applies_to_role')) {
            DB::statement("ALTER TABLE commission_rules ALTER COLUMN applies_to_role SET DEFAULT 'technician'");
        }

        if (Schema::hasTable('work_order_technicians') && Schema::hasColumn('work_order_technicians', 'role')) {
            DB::statement("ALTER TABLE work_order_technicians ALTER COLUMN role SET DEFAULT 'technician'");
        }
    }
};
