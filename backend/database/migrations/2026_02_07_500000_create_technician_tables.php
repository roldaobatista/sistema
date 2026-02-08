<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Agendamentos — visita/atendimento marcado
        Schema::create('schedules', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->unsignedBigInteger('technician_id'); // user_id do técnico
            $t->string('title');
            $t->text('notes')->nullable();
            $t->dateTime('scheduled_start');
            $t->dateTime('scheduled_end');
            $t->string('status', 20)->default('scheduled'); // scheduled, confirmed, completed, cancelled
            $t->string('address')->nullable(); // endereço da visita
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('technician_id')->references('id')->on('users');
            $t->index(['tenant_id', 'technician_id', 'scheduled_start']);
        });

        // Apontamento de horas
        Schema::create('time_entries', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('technician_id');
            $t->foreignId('schedule_id')->nullable()->constrained()->nullOnDelete();
            $t->dateTime('started_at');
            $t->dateTime('ended_at')->nullable();
            $t->integer('duration_minutes')->nullable(); // calculado
            $t->string('type', 20)->default('work'); // work, travel, waiting
            $t->text('description')->nullable();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('technician_id')->references('id')->on('users');
            $t->index(['tenant_id', 'technician_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_entries');
        Schema::dropIfExists('schedules');
    }
};
