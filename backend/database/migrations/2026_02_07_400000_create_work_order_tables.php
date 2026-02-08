<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Equipamentos do cliente
        Schema::create('equipments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $t->string('type', 100);          // "Ar-condicionado", "Impressora", etc.
            $t->string('brand', 100)->nullable();
            $t->string('model', 100)->nullable();
            $t->string('serial_number')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });

        // Ordem de Serviço
        Schema::create('work_orders', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('number', 20);                // OS-000001
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $t->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
            $t->unsignedBigInteger('branch_id')->nullable();
            $t->unsignedBigInteger('created_by');     // usuário que abriu
            $t->unsignedBigInteger('assigned_to')->nullable(); // técnico responsável

            $t->string('status', 30)->default('open');
            $t->string('priority', 10)->default('normal'); // low, normal, high, urgent

            // Detalhes
            $t->text('description');                  // Defeito relatado
            $t->text('internal_notes')->nullable();
            $t->text('technical_report')->nullable(); // Laudo técnico

            // Datas
            $t->dateTime('received_at')->nullable();  // data de recebimento do equipamento
            $t->dateTime('started_at')->nullable();
            $t->dateTime('completed_at')->nullable();
            $t->dateTime('delivered_at')->nullable();

            // Valores
            $t->decimal('discount', 12, 2)->default(0);
            $t->decimal('total', 12, 2)->default(0);

            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('branch_id')->references('id')->on('branches')->nullOnDelete();
            $t->foreign('created_by')->references('id')->on('users');
            $t->foreign('assigned_to')->references('id')->on('users')->nullOnDelete();
            $t->unique(['tenant_id', 'number']);
            $t->index(['tenant_id', 'status']);
            $t->index(['tenant_id', 'customer_id']);
        });

        // Itens da OS (produtos e serviços)
        Schema::create('work_order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->string('type', 10); // 'product' ou 'service'
            $t->unsignedBigInteger('reference_id')->nullable(); // product_id ou service_id
            $t->string('description'); // denormalizado para histórico
            $t->decimal('quantity', 12, 2)->default(1);
            $t->decimal('unit_price', 12, 2)->default(0);
            $t->decimal('discount', 12, 2)->default(0);
            $t->decimal('total', 12, 2)->default(0); // (qty * unit_price) - discount
            $t->timestamps();
        });

        // Histórico de status (timeline)
        Schema::create('work_order_status_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('user_id');
            $t->string('from_status', 30)->nullable();
            $t->string('to_status', 30);
            $t->text('notes')->nullable();
            $t->timestamps();

            $t->foreign('user_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_status_history');
        Schema::dropIfExists('work_order_items');
        Schema::dropIfExists('work_orders');
        Schema::dropIfExists('equipments');
    }
};
