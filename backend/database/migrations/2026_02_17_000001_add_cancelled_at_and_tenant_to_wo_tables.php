<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add missing columns: cancelled_at on work_orders, tenant_id on work_order_status_history.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Add cancelled_at to work_orders
        if (Schema::hasTable('work_orders') && !Schema::hasColumn('work_orders', 'cancelled_at')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->timestamp('cancelled_at')->nullable();
            });
        }

        // Add tenant_id to work_order_status_history (isolação multi-tenant)
        if (Schema::hasTable('work_order_status_history') && !Schema::hasColumn('work_order_status_history', 'tenant_id')) {
            Schema::table('work_order_status_history', function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->nullable();
            });

            // Backfill tenant_id from work_orders
            \Illuminate\Support\Facades\DB::statement('
                UPDATE work_order_status_history h
                SET h.tenant_id = (SELECT w.tenant_id FROM work_orders w WHERE w.id = h.work_order_id)
                WHERE h.tenant_id IS NULL
            ');
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('work_orders', 'cancelled_at')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->dropColumn('cancelled_at');
            });
        }

        if (Schema::hasColumn('work_order_status_history', 'tenant_id')) {
            Schema::table('work_order_status_history', function (Blueprint $table) {
                $table->dropColumn('tenant_id');
            });
        }
    }
};
