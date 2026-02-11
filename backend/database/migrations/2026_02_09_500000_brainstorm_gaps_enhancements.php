<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Item 8: billing_type para contratos recorrentes
        if (!Schema::hasColumn('recurring_contracts', 'billing_type')) {
            Schema::table('recurring_contracts', function (Blueprint $table) {
                $table->string('billing_type', 20)->nullable();
            });
            \DB::table('recurring_contracts')->whereNull('billing_type')->update(['billing_type' => 'per_os']);
        }

        if (!Schema::hasColumn('recurring_contracts', 'monthly_value')) {
            Schema::table('recurring_contracts', function (Blueprint $table) {
                $table->decimal('monthly_value', 12, 2)->nullable();
            });
        }

        // Item 10: campos metrológicos adicionais
        if (!Schema::hasColumn('equipment_calibrations', 'status')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $table->string('status', 20)->nullable();
            });
            \DB::table('equipment_calibrations')->whereNull('status')->update(['status' => 'pending']);
        }

        if (!Schema::hasColumn('equipment_calibrations', 'nominal_mass')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $table->string('nominal_mass')->nullable();
            });
        }

        if (!Schema::hasColumn('equipment_calibrations', 'error_after_adjustment')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $table->decimal('error_after_adjustment', 10, 4)->nullable();
            });
        }

        if (!Schema::hasColumn('equipment_calibrations', 'traceability')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $table->text('traceability')->nullable();
            });
        }

        // Item 13: SLA breach tracking
        if (!Schema::hasColumn('work_orders', 'sla_response_breached')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->boolean('sla_response_breached')->nullable();
            });
            \DB::table('work_orders')->whereNull('sla_response_breached')->update(['sla_response_breached' => false]);
        }

        if (!Schema::hasColumn('work_orders', 'sla_resolution_breached')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->boolean('sla_resolution_breached')->nullable();
            });
            \DB::table('work_orders')->whereNull('sla_resolution_breached')->update(['sla_resolution_breached' => false]);
        }
    }

    public function down(): void
    {
        // SQLite não suporta dropColumn facilmente, skip gracefully
    }
};
