<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('technician_cash_funds', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('user_id')->constrained()->cascadeOnDelete(); // técnico
            $t->decimal('balance', 12, 2)->default(0);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'user_id']);
        });

        Schema::create('technician_cash_transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('fund_id')->constrained('technician_cash_funds')->cascadeOnDelete();
            $t->enum('type', ['credit', 'debit']);
            $t->decimal('amount', 12, 2);
            $t->decimal('balance_after', 12, 2); // saldo após transação
            $t->foreignId('expense_id')->nullable()->constrained()->nullOnDelete(); // link despesa
            $t->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $t->unsignedBigInteger('created_by')->nullable();
            $t->string('description');
            $t->date('transaction_date');
            $t->timestamps();

            $t->foreign('created_by')->references('id')->on('users');
            $t->index(['fund_id', 'transaction_date']);
        });

        // Adicionar campo no expenses
        Schema::table('expenses', function (Blueprint $t) {
            $t->boolean('affects_technician_cash')->default(false)->after('receipt_path');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $t) {
            $t->dropColumn('affects_technician_cash');
        });
        Schema::dropIfExists('technician_cash_transactions');
        Schema::dropIfExists('technician_cash_funds');
    }
};
