<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Categorias de produtos
        Schema::create('product_categories', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'name']);
        });

        // Categorias de serviços
        Schema::create('service_categories', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'name']);
        });

        // Clientes
        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->enum('type', ['PF', 'PJ'])->default('PF');
            $t->string('name');
            $t->string('document', 20)->nullable(); // CPF ou CNPJ
            $t->string('email')->nullable();
            $t->string('phone', 20)->nullable();
            $t->string('phone2', 20)->nullable();

            // Endereço
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

        // Contatos do cliente
        Schema::create('customer_contacts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->string('role', 100)->nullable(); // cargo/função
            $t->string('phone', 20)->nullable();
            $t->string('email')->nullable();
            $t->boolean('is_primary')->default(false);
            $t->timestamps();
        });

        // Produtos
        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $t->string('code', 50)->nullable();
            $t->string('name');
            $t->text('description')->nullable();
            $t->string('unit', 10)->default('UN'); // UN, CX, KG, MT, etc.
            $t->decimal('cost_price', 12, 2)->default(0);
            $t->decimal('sell_price', 12, 2)->default(0);
            $t->decimal('stock_qty', 12, 2)->default(0);
            $t->decimal('stock_min', 12, 2)->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'code']);
            $t->index(['tenant_id', 'name']);
        });

        // Serviços
        Schema::create('services', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('category_id')->nullable()->constrained('service_categories')->nullOnDelete();
            $t->string('code', 50)->nullable();
            $t->string('name');
            $t->text('description')->nullable();
            $t->decimal('default_price', 12, 2)->default(0);
            $t->integer('estimated_minutes')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'code']);
            $t->index(['tenant_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
        Schema::dropIfExists('products');
        Schema::dropIfExists('customer_contacts');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('service_categories');
        Schema::dropIfExists('product_categories');
    }
};
