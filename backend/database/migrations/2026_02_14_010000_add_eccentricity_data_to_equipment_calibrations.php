<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipment_calibrations', function (Blueprint $table) {
            if (!Schema::hasColumn('equipment_calibrations', 'eccentricity_data')) {
                $table->json('eccentricity_data')->nullable()
                    ->comment('Eccentricity test data: positions, readings, errors per ISO 17025');
            }
        });
    }

    public function down(): void
    {
        Schema::table('equipment_calibrations', function (Blueprint $table) {
            $table->dropColumn('eccentricity_data');
        });
    }
};
