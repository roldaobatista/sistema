<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->string('invoice_number', 50);
            $table->string('nf_number', 50)->nullable()->comment('Número da NF-e / NFS-e');
            $table->enum('status', ['draft', 'issued', 'sent', 'cancelled'])->default('draft');
            $table->decimal('total', 12, 2)->default(0);
            $table->date('issued_at')->nullable();
            $table->date('due_date')->nullable();
            $table->text('observations')->nullable();
            $table->json('items')->nullable()->comment('Snapshot dos itens faturados');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'invoice_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
