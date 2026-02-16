<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('fleet_vehicles')) {
            return;
        }

        if (!Schema::hasTable('toll_records')) {
            Schema::create('toll_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('fleet_vehicle_id')->constrained('fleet_vehicles')->cascadeOnDelete();
                $table->date('passage_date');
                $table->string('toll_plaza', 150);
                $table->string('highway', 100)->nullable();
                $table->decimal('value', 10, 2);
                $table->string('tag_number', 50)->nullable();
                $table->string('payment_method', 30)->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('gps_tracking_history')) {
            Schema::create('gps_tracking_history', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('fleet_vehicle_id')->constrained('fleet_vehicles')->cascadeOnDelete();
                $table->decimal('lat', 10, 7);
                $table->decimal('lng', 10, 7);
                $table->timestamp('recorded_at');
                $table->timestamp('created_at')->useCurrent();

                $table->index(['fleet_vehicle_id', 'recorded_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('gps_tracking_history');
        Schema::dropIfExists('toll_records');
    }
};
