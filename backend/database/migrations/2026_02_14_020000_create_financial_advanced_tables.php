<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('supplier_contracts')) {
            Schema::create('supplier_contracts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('supplier_id')->constrained()->onDelete('cascade');
                $table->string('description');
                $table->date('start_date');
                $table->date('end_date');
                $table->decimal('value', 12, 2);
                $table->string('payment_frequency')->default('monthly');
                $table->boolean('auto_renew')->default(false);
                $table->string('status')->default('active');
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->index(['tenant_id', 'status']);
            });
        }

        if (!Schema::hasTable('financial_checks')) {
            Schema::create('financial_checks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('type'); // received, issued
                $table->string('number');
                $table->string('bank');
                $table->decimal('amount', 12, 2);
                $table->date('due_date');
                $table->string('issuer');
                $table->string('status')->default('pending');
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->index(['tenant_id', 'status', 'due_date']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_checks');
        Schema::dropIfExists('supplier_contracts');
    }
};
