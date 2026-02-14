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
            $table->foreignId('warehouse_id')->nullable()->after('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('batch_id')->nullable()->after('warehouse_id')->constrained()->onDelete('set null');
            $table->foreignId('product_serial_id')->nullable()->after('batch_id')->constrained()->onDelete('set null');
            $table->foreignId('target_warehouse_id')->nullable()->after('type')->constrained('warehouses')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            //
        });
    }
};
