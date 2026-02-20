<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('routes_planning')) {
            return;
        }

        Schema::create('routes_planning', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tech_id')->constrained('users')->cascadeOnDelete();
            if (Schema::hasTable('fleet_vehicles')) {
                $table->foreignId('vehicle_id')->nullable()->constrained('fleet_vehicles')->nullOnDelete();
            } else {
                $table->unsignedBigInteger('vehicle_id')->nullable();
            }
            $table->date('date');
            $table->json('optimized_path_json')->nullable();
            $table->decimal('total_distance_km', 8, 2)->nullable();
            $table->decimal('estimated_fuel_liters', 8, 2)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('routes_planning');
    }
};
