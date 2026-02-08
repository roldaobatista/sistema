<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Contas a Receber
        Schema::create('accounts_receivable', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $t->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $t->unsignedBigInteger('created_by');

            $t->string('description');
            $t->decimal('amount', 12, 2);
            $t->decimal('amount_paid', 12, 2)->default(0);
            $t->date('due_date');
            $t->date('paid_at')->nullable();
            $t->string('status', 20)->default('pending'); // pending, partial, paid, overdue, cancelled
            $t->string('payment_method', 30)->nullable(); // dinheiro, pix, cartao, boleto, transferencia
            $t->text('notes')->nullable();

            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('created_by')->references('id')->on('users');
            $t->index(['tenant_id', 'status']);
            $t->index(['tenant_id', 'due_date']);
            $t->index(['tenant_id', 'customer_id']);
        });

        // Contas a Pagar
        Schema::create('accounts_payable', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('created_by');

            $t->string('supplier')->nullable();
            $t->string('category', 50)->nullable(); // fornecedor, aluguel, salário, imposto, etc
            $t->string('description');
            $t->decimal('amount', 12, 2);
            $t->decimal('amount_paid', 12, 2)->default(0);
            $t->date('due_date');
            $t->date('paid_at')->nullable();
            $t->string('status', 20)->default('pending');
            $t->string('payment_method', 30)->nullable();
            $t->text('notes')->nullable();

            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('created_by')->references('id')->on('users');
            $t->index(['tenant_id', 'status']);
            $t->index(['tenant_id', 'due_date']);
        });

        // Pagamentos (baixas parciais ou totais — vinculados a AR ou AP)
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('payable_type'); // App\Models\AccountReceivable ou AccountPayable
            $t->unsignedBigInteger('payable_id');
            $t->unsignedBigInteger('received_by');

            $t->decimal('amount', 12, 2);
            $t->string('payment_method', 30);
            $t->date('payment_date');
            $t->text('notes')->nullable();

            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('received_by')->references('id')->on('users');
            $t->index(['payable_type', 'payable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('accounts_payable');
        Schema::dropIfExists('accounts_receivable');
    }
};
