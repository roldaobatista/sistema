<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('fleet_vehicles')) {
            return;
        }

        Schema::table('fleet_vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('fleet_vehicles', 'driver_score')) {
                $table->decimal('driver_score', 5, 2)->nullable()->comment('0-100 score');
            }
            if (!Schema::hasColumn('fleet_vehicles', 'total_toll_cost')) {
                $table->decimal('total_toll_cost', 12, 2)->default(0);
            }
            if (!Schema::hasColumn('fleet_vehicles', 'last_gps_lat')) {
                $table->decimal('last_gps_lat', 10, 7)->nullable();
            }
            if (!Schema::hasColumn('fleet_vehicles', 'last_gps_lng')) {
                $table->decimal('last_gps_lng', 10, 7)->nullable();
            }
            if (!Schema::hasColumn('fleet_vehicles', 'last_gps_at')) {
                $table->timestamp('last_gps_at')->nullable();
            }
            if (!Schema::hasColumn('fleet_vehicles', 'gps_device_id')) {
                $table->string('gps_device_id', 80)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $columns = ['driver_score', 'total_toll_cost', 'last_gps_lat', 'last_gps_lng', 'last_gps_at', 'gps_device_id'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('fleet_vehicles', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
