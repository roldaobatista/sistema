<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds fields required by ISO 17025:2017 §7.8, Portaria INMETRO 157/2022,
 * and OIML R76-1 for normative-compliant calibration certificates.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ─── equipment_calibrations: new normative fields ─────────
        Schema::table('equipment_calibrations', function (Blueprint $table) {
            if (!Schema::hasColumn('equipment_calibrations', 'gravity_acceleration')) {
                $table->decimal('gravity_acceleration', 10, 6)->nullable()
                    ->comment('Local gravity acceleration m/s² (IBGE)');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'decision_rule')) {
                $table->string('decision_rule', 30)->nullable()->default('simple')
                    ->comment('ISO 17025 §7.8.6: simple|guard_band|shared_risk');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'uncertainty_budget')) {
                $table->json('uncertainty_budget')->nullable()
                    ->comment('Full uncertainty budget (6 components per NIT-DICLA-021)');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'laboratory_address')) {
                $table->string('laboratory_address', 500)->nullable()
                    ->comment('Lab address for certificate header (ISO 17025 §7.8.2.1b)');
            }
            if (!Schema::hasColumn('equipment_calibrations', 'scope_declaration')) {
                $table->text('scope_declaration')->nullable()
                    ->comment('Scope limitation statement (ISO 17025 §7.8.2.1l)');
            }
        });

        // ─── calibration_readings: EMA and conformity per point ───
        Schema::table('calibration_readings', function (Blueprint $table) {
            if (!Schema::hasColumn('calibration_readings', 'ema')) {
                $table->decimal('ema', 12, 6)->nullable()
                    ->comment('EMA for this specific load point');
            }
            if (!Schema::hasColumn('calibration_readings', 'conforms')) {
                $table->boolean('conforms')->nullable()
                    ->comment('Whether error is within EMA');
            }
        });

        // ─── repeatability_tests: range_value field ───────────────
        if (Schema::hasTable('repeatability_tests')) {
            Schema::table('repeatability_tests', function (Blueprint $table) {
                if (!Schema::hasColumn('repeatability_tests', 'range_value')) {
                    $table->decimal('range_value', 12, 4)->nullable()
                        ->comment('Max - Min of measurements');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('equipment_calibrations', function (Blueprint $table) {
            $cols = ['gravity_acceleration', 'decision_rule', 'uncertainty_budget', 'laboratory_address', 'scope_declaration'];
            $drop = array_filter($cols, fn($c) => Schema::hasColumn('equipment_calibrations', $c));
            if ($drop) $table->dropColumn($drop);
        });

        Schema::table('calibration_readings', function (Blueprint $table) {
            $cols = ['ema', 'conforms'];
            $drop = array_filter($cols, fn($c) => Schema::hasColumn('calibration_readings', $c));
            if ($drop) $table->dropColumn($drop);
        });

        if (Schema::hasTable('repeatability_tests') && Schema::hasColumn('repeatability_tests', 'range_value')) {
            Schema::table('repeatability_tests', function (Blueprint $table) {
                $table->dropColumn('range_value');
            });
        }
    }
};
