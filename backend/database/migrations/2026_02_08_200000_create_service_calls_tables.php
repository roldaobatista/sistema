<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_calls', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('call_number', 30);
            $t->unsignedBigInteger('customer_id');
            $t->unsignedBigInteger('quote_id')->nullable();
            $t->unsignedBigInteger('technician_id')->nullable();
            $t->unsignedBigInteger('driver_id')->nullable();
            $t->string('status', 25)->default('open');
            // open, scheduled, in_transit, in_progress, completed, cancelled
            $t->string('priority', 10)->default('normal');
            // low, normal, high, urgent
            $t->datetime('scheduled_date')->nullable();
            $t->datetime('started_at')->nullable();
            $t->datetime('completed_at')->nullable();
            $t->decimal('latitude', 10, 7)->nullable();
            $t->decimal('longitude', 10, 7)->nullable();
            $t->string('address')->nullable();
            $t->string('city')->nullable();
            $t->string('state', 2)->nullable();
            $t->text('observations')->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $t->foreign('quote_id')->references('id')->on('quotes')->nullOnDelete();
            $t->foreign('technician_id')->references('id')->on('users')->nullOnDelete();
            $t->foreign('driver_id')->references('id')->on('users')->nullOnDelete();
            $t->index(['tenant_id', 'status']);
        });

        // Chamado pode ter múltiplos equipamentos
        Schema::create('service_call_equipments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('service_call_id');
            $t->unsignedBigInteger('equipment_id');
            $t->text('observations')->nullable();
            $t->timestamps();

            $t->foreign('service_call_id')->references('id')->on('service_calls')->cascadeOnDelete();
            $t->foreign('equipment_id')->references('id')->on('equipments')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_call_equipments');
        Schema::dropIfExists('service_calls');
    }
};
