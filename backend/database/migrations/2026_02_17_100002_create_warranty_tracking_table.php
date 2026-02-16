<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('warranty_tracking')) {
            return;
        }

        Schema::create('warranty_tracking', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->foreignId('work_order_id')->constrained('work_orders')->onDelete('cascade');
            $table->foreignId('customer_id')->constrained('customers')->onDelete('cascade');
            $table->foreignId('equipment_id')->nullable()->constrained('equipments')->onDelete('set null');
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('set null');
            $table->foreignId('work_order_item_id')->nullable()->constrained('work_order_items')->onDelete('set null');
            $table->date('warranty_start_at');
            $table->date('warranty_end_at');
            $table->string('warranty_type', 30)->default('part');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->index(['tenant_id', 'warranty_end_at'], 'warranty_tenant_end_idx');
            $table->index(['customer_id', 'warranty_end_at'], 'warranty_customer_end_idx');
            $table->index(['equipment_id', 'warranty_end_at'], 'warranty_equip_end_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warranty_tracking');
    }
};
