<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_categories', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->string('color', 7)->default('#6b7280'); // hex
            $t->boolean('active')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });

        Schema::create('expenses', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('expense_category_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $t->unsignedBigInteger('created_by');
            $t->unsignedBigInteger('approved_by')->nullable();
            $t->string('description');
            $t->decimal('amount', 12, 2);
            $t->date('expense_date');
            $t->string('payment_method', 30)->nullable();
            $t->string('status', 20)->default('pending'); // pending, approved, rejected, reimbursed
            $t->text('notes')->nullable();
            $t->string('receipt_path')->nullable(); // caminho do comprovante
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('created_by')->references('id')->on('users');
            $t->foreign('approved_by')->references('id')->on('users');
            $t->index(['tenant_id', 'status', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('expense_categories');
    }
};
