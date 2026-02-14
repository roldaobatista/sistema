<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('restrict');

            $table->string('type', 10); // nfe, nfse
            $table->foreignId('work_order_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
            $table->foreignId('quote_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
            $table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('restrict');

            $table->string('number')->nullable();
            $table->string('series')->nullable();
            $table->string('access_key')->nullable()->unique();

            $table->string('status', 20)->default('pending'); // pending, authorized, cancelled, rejected

            $table->string('provider', 30)->default('nuvemfiscal');
            $table->string('provider_id')->nullable();

            $table->decimal('total_amount', 15, 2)->default(0);

            $table->timestamp('issued_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('cancel_reason')->nullable();

            $table->text('pdf_url')->nullable();
            $table->text('xml_url')->nullable();
            $table->text('error_message')->nullable();

            $table->json('raw_response')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');

            $table->timestamps();

            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'customer_id']);
            $table->index('work_order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_notes');
    }
};
