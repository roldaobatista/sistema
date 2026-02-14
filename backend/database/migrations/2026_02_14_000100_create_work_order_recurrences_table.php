<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_order_recurrences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('restrict');
            $table->foreignId('service_id')->nullable()->constrained('services')->onUpdate('cascade')->onDelete('set null');
            
            $table->string('name');
            $table->text('description')->nullable();
            
            $table->enum('frequency', ['weekly', 'monthly', 'quarterly', 'semi_annually', 'annually']);
            $table->integer('interval')->default(1);
            $table->integer('day_of_month')->nullable(); // 1-31
            $table->integer('day_of_week')->nullable(); // 0-6 (Sun-Sat)
            
            $table->date('start_date');
            $table->date('end_date')->nullable();
            
            $table->timestamp('last_generated_at')->nullable();
            $table->date('next_generation_date');
            
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable(); // Template values like technician_id, items, etc.
            
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_recurrences');
    }
};
