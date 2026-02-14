<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reconciliation_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->enum('match_field', ['description', 'amount', 'cnpj', 'combined'])->default('description');
            $table->enum('match_operator', ['contains', 'equals', 'regex', 'between'])->default('contains');
            $table->string('match_value')->nullable();
            $table->decimal('match_amount_min', 15, 2)->nullable();
            $table->decimal('match_amount_max', 15, 2)->nullable();
            $table->enum('action', ['match_receivable', 'match_payable', 'ignore', 'categorize'])->default('categorize');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('category')->nullable();
            $table->foreignId('customer_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
            $table->foreignId('supplier_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
            $table->unsignedSmallInteger('priority')->default(10);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('times_applied')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciliation_rules');
    }
};
