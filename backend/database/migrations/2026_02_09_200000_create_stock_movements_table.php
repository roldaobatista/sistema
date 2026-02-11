<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $t->string('type', 20); // entry, exit, reserve, return, adjustment
            $t->decimal('quantity', 12, 2);
            $t->decimal('unit_cost', 12, 2)->default(0);
            $t->string('reference')->nullable(); // "OS-000123", "Ajuste manual"
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->index(['tenant_id', 'product_id']);
            $t->index(['tenant_id', 'type']);
            $t->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
