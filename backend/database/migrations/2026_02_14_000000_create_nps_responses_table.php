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
        Schema::create('nps_responses', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $blueprint->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $blueprint->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $blueprint->unsignedTinyInteger('score'); // 0-10
            $blueprint->text('comment')->nullable();
            $blueprint->timestamps();

            $blueprint->index(['tenant_id', 'score']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nps_responses');
    }
};
