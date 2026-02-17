<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->enum('type', ['PF', 'PJ'])->default('PJ');
            $t->string('name');
            $t->string('document', 20)->nullable();
            $t->string('trade_name')->nullable();
            $t->string('email')->nullable();
            $t->string('phone', 20)->nullable();
            $t->string('phone2', 20)->nullable();
            $t->string('address_zip', 10)->nullable();
            $t->string('address_street')->nullable();
            $t->string('address_number', 20)->nullable();
            $t->string('address_complement', 100)->nullable();
            $t->string('address_neighborhood', 100)->nullable();
            $t->string('address_city', 100)->nullable();
            $t->string('address_state', 2)->nullable();
            $t->text('notes')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->index(['tenant_id', 'name']);
            $t->index(['tenant_id', 'document']);
        });

        Schema::table('accounts_payable', function (Blueprint $t) {
            $t->foreignId('supplier_id')->nullable()
                ->constrained('suppliers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('accounts_payable', function (Blueprint $t) {
            $t->dropForeign(['supplier_id']);
            $t->dropColumn('supplier_id');
        });
        Schema::dropIfExists('suppliers');
    }
};
