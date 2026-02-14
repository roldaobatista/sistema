<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name'); // Ex: "Bradesco AG 1234"
            $t->string('bank_name'); // Nome do banco
            $t->string('agency')->nullable();
            $t->string('account_number')->nullable();
            $t->enum('account_type', ['corrente', 'poupanca', 'pagamento'])->default('corrente');
            $t->string('pix_key')->nullable();
            $t->decimal('balance', 12, 2)->default(0);
            $t->boolean('is_active')->default(true);
            $t->unsignedBigInteger('created_by');
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('created_by')->references('id')->on('users');
            $t->index(['tenant_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
    }
};
