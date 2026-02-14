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
        if (!Schema::hasTable('trainings')) {
            Schema::create('trainings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id'); // Foreign key to tenants
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->string('title');
                $table->string('institution');
                $table->string('certificate_number')->nullable(); // Optional
                $table->date('completion_date');
                $table->date('expiry_date')->nullable();
                $table->string('category');
                $table->integer('hours');
                $table->string('status')->default('completed'); // e.g., completed, expired
                $table->text('notes')->nullable();
                
                // Re-adding columns that are added in 000009 to be safe/consistent if run from scratch, 
                // but usually 000009 handles them. 
                // However, looking at 000009, it uses Schema::table to ADD them.
                // So here we validly create the BASE table.
                
                $table->timestamps();
                
                // Add foreign key constraint for tenant_id if tenants table exists, 
                // otherwise just index it. Assuming tenants table exists from 2026_02_07_200000.
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trainings');
    }
};
