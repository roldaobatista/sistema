<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Enrich equipment_calibrations
        if (Schema::hasTable('equipment_calibrations')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                if (!Schema::hasColumn('equipment_calibrations', 'certificate_pdf_path')) {
                    $table->string('certificate_pdf_path', 255)->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'standard_used')) {
                    $table->string('standard_used', 255)->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'error_found')) {
                    $table->decimal('error_found', 10, 4)->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'uncertainty')) {
                    $table->decimal('uncertainty', 10, 4)->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'result')) {
                    $table->string('result', 50)->default('approved');
                }
                if (!Schema::hasColumn('equipment_calibrations', 'technician_notes')) {
                    $table->text('technician_notes')->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'temperature')) {
                    $table->decimal('temperature', 5, 2)->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'humidity')) {
                    $table->decimal('humidity', 5, 2)->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'pressure')) {
                    $table->decimal('pressure', 8, 2)->nullable();
                }
            });
        } else {
            // Create if matches fail or table missing in previous context (safety net)
            Schema::create('equipment_calibrations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('equipment_id');
                $table->date('calibration_date');
                $table->date('next_calibration_date')->nullable();
                $table->string('certificate_number')->nullable();
                $table->string('performed_by')->nullable(); // Technician or External Lab
                
                // New fields
                $table->string('certificate_pdf_path', 255)->nullable();
                $table->string('standard_used', 255)->nullable();
                $table->decimal('error_found', 10, 4)->nullable();
                $table->decimal('uncertainty', 10, 4)->nullable();
                $table->string('result', 50)->default('approved'); // approved, rejected, adjusted
                $table->text('technician_notes')->nullable();
                $table->decimal('temperature', 5, 2)->nullable();
                $table->decimal('humidity', 5, 2)->nullable();
                $table->decimal('pressure', 8, 2)->nullable();

                $table->text('notes')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $table->foreign('equipment_id')->references('id')->on('equipments')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('equipment_calibrations', 'error_found')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $table->dropColumn([
                    'certificate_pdf_path', 'standard_used', 'error_found', 
                    'uncertainty', 'result', 'technician_notes',
                    'temperature', 'humidity', 'pressure'
                ]);
            });
        }
    }
};
