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
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreignId('warehouse_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('batch_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('product_serial_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('target_warehouse_id')->nullable()->constrained('warehouses')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $columns = ['target_warehouse_id', 'product_serial_id', 'batch_id', 'warehouse_id'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('stock_movements', $col)) {
                    $table->dropForeign([$col]);
                    $table->dropColumn($col);
                }
            }
        });
    }
};
