<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $childTables = [
        'work_order_items' => 'work_order_id:work_orders',
        'work_order_status_history' => 'work_order_id:work_orders',
        'work_order_attachments' => 'work_order_id:work_orders',
        'quote_items' => 'quote_equipment_id:quote_equipments:quote_id:quotes',
        'quote_equipments' => 'quote_id:quotes',
        'quote_photos' => 'quote_equipment_id:quote_equipments:quote_id:quotes',
        'customer_contacts' => 'customer_id:customers',
        'equipment_calibrations' => 'equipment_id:equipments',
        'equipment_maintenances' => 'equipment_id:equipments',
        'equipment_documents' => 'equipment_id:equipments',
        'recurring_contract_items' => 'recurring_contract_id:recurring_contracts',
        'crm_pipeline_stages' => 'pipeline_id:crm_pipelines',
        'technician_cash_transactions' => 'fund_id:technician_cash_funds',
    ];

    public function up(): void
    {
        foreach ($this->childTables as $table => $relation) {
            if (!Schema::hasColumn($table, 'tenant_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->unsignedBigInteger('tenant_id')->nullable()->after('id');
                    $t->index('tenant_id');
                });

                // Backfill tenant_id from parent table
                $parts = explode(':', $relation);
                $fk = $parts[0];
                $parentTable = $parts[1];

                // Handle chain relations (e.g., quote_items -> quote_equipments -> quotes)
                if (count($parts) === 4) {
                    $midFk = $parts[0];
                    $midTable = $parts[1];
                    $parentFk = $parts[2];
                    $parentTable = $parts[3];

                    DB::statement("
                        UPDATE {$table} c
                        INNER JOIN {$midTable} m ON c.{$midFk} = m.id
                        INNER JOIN {$parentTable} p ON m.{$parentFk} = p.id
                        SET c.tenant_id = p.tenant_id
                        WHERE c.tenant_id IS NULL
                    ");
                } else {
                    DB::statement("
                        UPDATE {$table} c
                        INNER JOIN {$parentTable} p ON c.{$fk} = p.id
                        SET c.tenant_id = p.tenant_id
                        WHERE c.tenant_id IS NULL
                    ");
                }

                // Add foreign key constraint after backfilling
                Schema::table($table, function (Blueprint $t) {
                    $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                });
            }
        }
    }

    public function down(): void
    {
        foreach ($this->childTables as $table => $relation) {
            if (Schema::hasColumn($table, 'tenant_id')) {
                Schema::table($table, function (Blueprint $t) use ($table) {
                    $t->dropForeign(["{$table}_tenant_id_foreign"]);
                    $t->dropColumn('tenant_id');
                });
            }
        }
    }
};
