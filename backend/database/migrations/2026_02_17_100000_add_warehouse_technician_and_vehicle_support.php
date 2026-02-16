<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('warehouses')) {
            return;
        }

        Schema::table('warehouses', function (Blueprint $table) {
            if (!Schema::hasColumn('warehouses', 'user_id')) {
                $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('warehouses', 'vehicle_id')) {
                if (Schema::hasTable('fleet_vehicles')) {
                    $table->unsignedBigInteger('vehicle_id')->nullable();
                    $table->foreign('vehicle_id')->references('id')->on('fleet_vehicles')->onDelete('set null');
                }
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            $typeCol = Schema::getColumnType('warehouses', 'type');
            if ($typeCol === 'string' || $typeCol === 'enum') {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE warehouses MODIFY COLUMN type VARCHAR(20) NOT NULL DEFAULT 'fixed'");
            }
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('warehouses')) {
            return;
        }

        Schema::table('warehouses', function (Blueprint $table) {
            if (Schema::hasColumn('warehouses', 'vehicle_id')) {
                $table->dropForeign(['vehicle_id']);
            }
            if (Schema::hasColumn('warehouses', 'user_id')) {
                $table->dropForeign(['user_id']);
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            \Illuminate\Support\Facades\DB::statement("ALTER TABLE warehouses MODIFY COLUMN type ENUM('fixed','vehicle') NOT NULL DEFAULT 'fixed'");
        }
    }
};
