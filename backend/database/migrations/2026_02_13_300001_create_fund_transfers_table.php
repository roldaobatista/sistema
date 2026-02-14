<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fund_transfers', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('bank_account_id')->constrained('bank_accounts')->restrictOnDelete();
            $t->foreignId('to_user_id')->constrained('users')->restrictOnDelete();
            $t->decimal('amount', 12, 2);
            $t->date('transfer_date');
            $t->string('payment_method', 30); // pix, ted, dinheiro
            $t->string('description');
            $t->foreignId('account_payable_id')->nullable()->constrained('accounts_payable')->nullOnDelete();
            $t->unsignedBigInteger('technician_cash_transaction_id')->nullable();
            $t->enum('status', ['completed', 'cancelled'])->default('completed');
            $t->unsignedBigInteger('created_by');
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('technician_cash_transaction_id')->references('id')->on('technician_cash_transactions')->nullOnDelete();
            $t->foreign('created_by')->references('id')->on('users');
            $t->index(['tenant_id', 'status', 'transfer_date']);
            $t->index(['tenant_id', 'to_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fund_transfers');
    }
};
