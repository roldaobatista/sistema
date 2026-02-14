<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add base geolocation fields to the inmetro_config JSON column is not ideal.
        // Instead, create a dedicated table for INMETRO base configuration.
        Schema::create('inmetro_base_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->decimal('base_lat', 10, 7)->nullable();
            $table->decimal('base_lng', 10, 7)->nullable();
            $table->string('base_address')->nullable();
            $table->string('base_city')->nullable();
            $table->string('base_state', 2)->nullable();
            $table->integer('max_distance_km')->default(200);
            $table->json('enrichment_sources')->nullable()->comment('List of active enrichment sources');
            $table->timestamp('last_enrichment_at')->nullable();
            $table->timestamps();

            $table->unique('tenant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inmetro_base_configs');
    }
};
