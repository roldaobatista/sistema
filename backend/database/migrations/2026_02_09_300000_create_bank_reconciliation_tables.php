<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_statements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('filename', 255);
            $table->timestamp('imported_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->integer('total_entries')->default(0);
            $table->integer('matched_entries')->default(0);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('bank_statement_entries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('bank_statement_id');
            $table->unsignedBigInteger('tenant_id');
            $table->date('date');
            $table->text('description')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('type', 10); // credit, debit
            $table->string('matched_type', 50)->nullable(); // account_receivable, account_payable
            $table->unsignedBigInteger('matched_id')->nullable();
            $table->string('status', 20)->default('pending'); // pending, matched, ignored
            $table->timestamps();

            $table->foreign('bank_statement_id')->references('id')->on('bank_statements')->cascadeOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_statement_entries');
        Schema::dropIfExists('bank_statements');
    }
};
