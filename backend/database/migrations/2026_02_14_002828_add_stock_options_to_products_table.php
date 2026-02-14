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
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_kit')->default(false)->after('track_stock');
            $table->boolean('track_batch')->default(false)->after('is_kit');
            $table->boolean('track_serial')->default(false)->after('track_batch');
            $table->decimal('min_repo_point', 15, 2)->nullable()->after('stock_min');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            //
        });
    }
};
