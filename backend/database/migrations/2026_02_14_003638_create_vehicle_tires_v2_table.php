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
        if (Schema::hasTable('vehicle_tires')) {
            return;
        }

        Schema::create('vehicle_tires', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fleet_vehicle_id')->constrained('fleet_vehicles')->cascadeOnDelete();
            $table->string('serial_number')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->string('position')->comment('E1, E2, D1, D2, etc.');
            $table->decimal('tread_depth', 5, 2)->nullable()->comment('Profundidade do sulco em mm');
            $table->integer('retread_count')->default(0)->comment('Número de recauchutagens');
            $table->date('installed_at')->nullable();
            $table->integer('installed_km')->nullable();
            $table->string('status')->default('active'); // active, retired, warehouse
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicle_tires');
    }
};
