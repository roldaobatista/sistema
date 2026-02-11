<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. work_order_attachments
        if (!Schema::hasColumn('work_order_attachments', 'tenant_id')) {
            Schema::table('work_order_attachments', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable()->after('id')->constrained('tenants')->cascadeOnDelete();
            });

            // Subquery compatível com SQLite e MySQL
            DB::statement('
                UPDATE work_order_attachments
                SET tenant_id = (SELECT wo.tenant_id FROM work_orders wo WHERE wo.id = work_order_attachments.work_order_id)
                WHERE work_order_id IS NOT NULL
            ');

            Schema::table('work_order_attachments', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable(false)->change();
            });
        }

        // 2. work_order_status_history
        if (!Schema::hasColumn('work_order_status_history', 'tenant_id')) {
            Schema::table('work_order_status_history', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable()->after('id')->constrained('tenants')->cascadeOnDelete();
            });

            DB::statement('
                UPDATE work_order_status_history
                SET tenant_id = (SELECT wo.tenant_id FROM work_orders wo WHERE wo.id = work_order_status_history.work_order_id)
                WHERE work_order_id IS NOT NULL
            ');

            Schema::table('work_order_status_history', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable(false)->change();
            });
        }

        // 3. work_order_checklist_responses
        if (!Schema::hasColumn('work_order_checklist_responses', 'tenant_id')) {
            Schema::table('work_order_checklist_responses', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable()->after('id')->constrained('tenants')->cascadeOnDelete();
            });

            DB::statement('
                UPDATE work_order_checklist_responses
                SET tenant_id = (SELECT wo.tenant_id FROM work_orders wo WHERE wo.id = work_order_checklist_responses.work_order_id)
                WHERE work_order_id IS NOT NULL
            ');

            Schema::table('work_order_checklist_responses', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        Schema::table('work_order_attachments', function (Blueprint $table) {
            if (Schema::hasColumn('work_order_attachments', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });

        Schema::table('work_order_status_history', function (Blueprint $table) {
            if (Schema::hasColumn('work_order_status_history', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });

        Schema::table('work_order_checklist_responses', function (Blueprint $table) {
            if (Schema::hasColumn('work_order_checklist_responses', 'tenant_id')) {
                $table->dropForeign(['tenant_id']);
                $table->dropColumn('tenant_id');
            }
        });
    }
};
