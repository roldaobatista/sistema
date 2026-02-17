<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('work_order_items', 'tenant_id')) {
                $table->unsignedBigInteger('tenant_id')->nullable();
                $table->index('tenant_id');
            }
        });

        // Preencher tenant_id dos itens existentes baseado na OS pai
        \Illuminate\Support\Facades\DB::statement('
            UPDATE work_order_items
            SET tenant_id = (
                SELECT work_orders.tenant_id FROM work_orders WHERE work_orders.id = work_order_items.work_order_id
            )
            WHERE tenant_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('work_order_items', function (Blueprint $table) {
            $table->dropColumn('tenant_id');
        });
    }
};
