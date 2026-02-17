<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $t) {
            $t->unsignedBigInteger('quote_id')->nullable();
            $t->unsignedBigInteger('service_call_id')->nullable();
            $t->unsignedBigInteger('seller_id')->nullable();
            $t->unsignedBigInteger('driver_id')->nullable();
            $t->string('os_number', 30)->nullable();
            $t->string('origin_type', 20)->nullable(); // quote, service_call, direct
            $t->decimal('discount_percentage', 5, 2)->default(0);
            $t->decimal('discount_amount', 12, 2)->default(0);

            $t->foreign('quote_id')->references('id')->on('quotes')->nullOnDelete();
            $t->foreign('service_call_id')->references('id')->on('service_calls')->nullOnDelete();
            $t->foreign('seller_id')->references('id')->on('users')->nullOnDelete();
            $t->foreign('driver_id')->references('id')->on('users')->nullOnDelete();
        });

        // Pivô: OS ↔ N técnicos
        Schema::create('work_order_technicians', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('work_order_id');
            $t->unsignedBigInteger('user_id');
            $t->string('role', 20)->default('technician'); // technician, driver, assistant
            $t->timestamps();

            $t->foreign('work_order_id')->references('id')->on('work_orders')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->unique(['work_order_id', 'user_id']);
        });

        // Pivô: OS ↔ N equipamentos
        Schema::create('work_order_equipments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('work_order_id');
            $t->unsignedBigInteger('equipment_id');
            $t->text('observations')->nullable();
            $t->timestamps();

            $t->foreign('work_order_id')->references('id')->on('work_orders')->cascadeOnDelete();
            $t->foreign('equipment_id')->references('id')->on('equipments')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_equipments');
        Schema::dropIfExists('work_order_technicians');

        Schema::table('work_orders', function (Blueprint $t) {
            $t->dropForeign(['quote_id']);
            $t->dropForeign(['service_call_id']);
            $t->dropForeign(['seller_id']);
            $t->dropForeign(['driver_id']);
            $t->dropColumn(['quote_id', 'service_call_id', 'seller_id', 'driver_id', 'os_number', 'origin_type', 'discount_percentage', 'discount_amount']);
        });
    }
};
