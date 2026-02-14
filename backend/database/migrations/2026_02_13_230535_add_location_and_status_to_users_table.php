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
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('location_lat', 10, 8)->nullable()->after('is_active');
            $table->decimal('location_lng', 11, 8)->nullable()->after('location_lat');
            $table->timestamp('location_updated_at')->nullable()->after('location_lng');
            $table->enum('status', ['available', 'in_transit', 'working', 'offline'])
                  ->default('offline')
                  ->after('location_updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            //
        });
    }
};
