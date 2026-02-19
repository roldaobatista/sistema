<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipment_calibrations', function (Blueprint $table) {
            if (!Schema::hasColumn('equipment_calibrations', 'received_date')) {
                $table->date('received_date')->nullable();
            }
            if (!Schema::hasColumn('equipment_calibrations', 'issued_date')) {
                $table->date('issued_date')->nullable();
            }
            if (!Schema::hasColumn('equipment_calibrations', 'calibration_location')) {
                $table->string('calibration_location', 500)->nullable();
            }
            if (!Schema::hasColumn('equipment_calibrations', 'calibration_location_type')) {
                $table->string('calibration_location_type', 30)->nullable()
                    ->comment('laboratory|client_site');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'before_adjustment_data')) {
                $table->json('before_adjustment_data')->nullable()
                    ->comment('Readings before adjustment (ISO 17025 7.8.4.1)');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'after_adjustment_data')) {
                $table->json('after_adjustment_data')->nullable()
                    ->comment('Readings after adjustment (ISO 17025 7.8.4.1)');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'verification_type')) {
                $table->string('verification_type', 30)->nullable()
                    ->comment('initial|subsequent|in_use');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'verification_division_e')) {
                $table->decimal('verification_division_e', 10, 6)->nullable()
                    ->comment('Verification division value "e" per OIML R76');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'prefilled_from_id')) {
                $table->unsignedBigInteger('prefilled_from_id')->nullable();
                $table->foreign('prefilled_from_id')
                    ->references('id')->on('equipment_calibrations')
                    ->nullOnDelete();
            }
        });

        if (!Schema::hasTable('repeatability_tests')) {
            Schema::create('repeatability_tests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('equipment_calibration_id');
                $table->decimal('load_value', 12, 4);
                $table->string('unit', 10)->default('kg');
                $table->decimal('measurement_1', 12, 4)->nullable();
                $table->decimal('measurement_2', 12, 4)->nullable();
                $table->decimal('measurement_3', 12, 4)->nullable();
                $table->decimal('measurement_4', 12, 4)->nullable();
                $table->decimal('measurement_5', 12, 4)->nullable();
                $table->decimal('measurement_6', 12, 4)->nullable();
                $table->decimal('measurement_7', 12, 4)->nullable();
                $table->decimal('measurement_8', 12, 4)->nullable();
                $table->decimal('measurement_9', 12, 4)->nullable();
                $table->decimal('measurement_10', 12, 4)->nullable();
                $table->decimal('mean', 12, 4)->nullable();
                $table->decimal('std_deviation', 12, 6)->nullable();
                $table->decimal('uncertainty_type_a', 12, 6)->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $table->foreign('equipment_calibration_id')
                    ->references('id')->on('equipment_calibrations')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('repeatability_tests');

        Schema::table('equipment_calibrations', function (Blueprint $table) {
            $cols = [
                'received_date', 'issued_date', 'calibration_location',
                'calibration_location_type', 'before_adjustment_data',
                'after_adjustment_data', 'verification_type',
                'verification_division_e', 'prefilled_from_id',
            ];
            $existing = [];
            foreach ($cols as $col) {
                if (Schema::hasColumn('equipment_calibrations', $col)) {
                    $existing[] = $col;
                }
            }
            if ($existing) {
                if (in_array('prefilled_from_id', $existing)) {
                    $table->dropForeign(['prefilled_from_id']);
                }
                $table->dropColumn($existing);
            }
        });
    }
};
