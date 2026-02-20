<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'qr_hash')) {
                $table->string('qr_hash')->nullable()->unique();
            }
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_movements', 'scanned_via_qr')) {
                $table->boolean('scanned_via_qr')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'qr_hash')) {
                $table->dropColumn('qr_hash');
            }
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('stock_movements', 'scanned_via_qr')) {
                $table->dropColumn('scanned_via_qr');
            }
        });
    }
};
