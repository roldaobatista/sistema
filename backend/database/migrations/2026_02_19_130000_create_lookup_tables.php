<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $tables = [
        'equipment_categories',
        'customer_segments',
        'lead_sources',
        'contract_types',
        'measurement_units',
        'calibration_types',
        'maintenance_types',
        'document_types',
        'account_receivable_categories',
        'cancellation_reasons',
    ];

    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (!Schema::hasTable($tableName)) {
                Schema::create($tableName, function (Blueprint $table) use ($tableName) {
                    $table->id();
                    $table->unsignedBigInteger('tenant_id')->nullable();
                    $table->string('name');
                    $table->string('slug');
                    $table->string('description')->nullable();
                    $table->string('color', 20)->nullable();
                    $table->string('icon', 50)->nullable();
                    $table->boolean('is_active')->default(true);
                    $table->unsignedInteger('sort_order')->default(0);
                    $table->timestamps();
                    $table->softDeletes();

                    $table->index('tenant_id', $tableName . '_tid_idx');
                    $table->unique(['tenant_id', 'slug'], $tableName . '_tid_slug_uq');
                });
            }
        }

        if (Schema::hasTable('measurement_units')) {
            if (!Schema::hasColumn('measurement_units', 'abbreviation')) {
                Schema::table('measurement_units', function (Blueprint $table) {
                    $table->string('abbreviation', 20)->nullable();
                    $table->string('unit_type', 30)->nullable();
                });
            }
        }

        if (Schema::hasTable('cancellation_reasons')) {
            if (!Schema::hasColumn('cancellation_reasons', 'applies_to')) {
                Schema::table('cancellation_reasons', function (Blueprint $table) {
                    $table->json('applies_to')->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->tables) as $table) {
            Schema::dropIfExists($table);
        }
    }
};
