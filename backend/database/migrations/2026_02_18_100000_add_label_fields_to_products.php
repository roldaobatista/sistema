<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('products')) {
            return;
        }
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'manufacturer_code')) {
                $table->string('manufacturer_code', 100)->nullable();
            }
            if (!Schema::hasColumn('products', 'storage_location')) {
                $table->string('storage_location', 100)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('products')) {
            return;
        }
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'storage_location')) {
                $table->dropColumn('storage_location');
            }
            if (Schema::hasColumn('products', 'manufacturer_code')) {
                $table->dropColumn('manufacturer_code');
            }
        });
    }
};
