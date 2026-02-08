<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50); // calibration_due, calibration_overdue, os_assigned, os_completed, etc.
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('icon', 30)->nullable();
            $table->string('color', 30)->nullable();
            $table->string('link')->nullable(); // rota frontend para navegar
            $table->nullableMorphs('notifiable'); // polimórfico (Equipment, WorkOrder, etc.)
            $table->json('data')->nullable(); // metadados extras
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
