<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_insurances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fleet_vehicle_id')->constrained('fleet_vehicles')->cascadeOnDelete();
            $table->string('insurer', 150);
            $table->string('policy_number', 80)->nullable();
            $table->string('coverage_type', 50)->default('comprehensive'); // comprehensive, third_party, total_loss
            $table->decimal('premium_value', 12, 2)->default(0);
            $table->decimal('deductible_value', 12, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('broker_name', 150)->nullable();
            $table->string('broker_phone', 30)->nullable();
            $table->string('status', 30)->default('active'); // active, expired, cancelled, pending
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_insurances');
    }
};
