<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('central_time_entries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->foreignId('central_item_id')->constrained('central_items')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('stopped_at')->nullable();
            $table->unsignedInteger('duration_seconds')->default(0)->comment('Calculated on stop');
            $table->string('descricao', 255)->nullable();
            $table->timestamps();

            $table->index(['central_item_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('central_time_entries');
    }
};
