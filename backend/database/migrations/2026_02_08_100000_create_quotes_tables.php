<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('quote_number', 30);
            $t->unsignedBigInteger('customer_id');
            $t->unsignedBigInteger('seller_id'); // vendedor
            $t->string('status', 20)->default('draft');
            // draft, sent, approved, rejected, expired, invoiced
            $t->date('valid_until')->nullable();
            $t->decimal('discount_percentage', 5, 2)->default(0);
            $t->decimal('discount_amount', 12, 2)->default(0);
            $t->decimal('subtotal', 12, 2)->default(0);
            $t->decimal('total', 12, 2)->default(0);
            $t->text('observations')->nullable();
            $t->text('internal_notes')->nullable();
            $t->timestamp('sent_at')->nullable();
            $t->timestamp('approved_at')->nullable();
            $t->timestamp('rejected_at')->nullable();
            $t->string('rejection_reason')->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $t->foreign('seller_id')->references('id')->on('users');
            $t->index(['tenant_id', 'status']);
            $t->unique(['tenant_id', 'quote_number']);
        });

        Schema::create('quote_equipments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('quote_id');
            $t->unsignedBigInteger('equipment_id')->nullable();
            $t->text('description')->nullable(); // descrição do que será feito
            $t->integer('sort_order')->default(0);
            $t->timestamps();

            $t->foreign('quote_id')->references('id')->on('quotes')->cascadeOnDelete();
            $t->foreign('equipment_id')->references('id')->on('equipments')->cascadeOnDelete();
        });

        Schema::create('quote_items', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('quote_equipment_id');
            $t->string('type', 10); // product, service
            $t->unsignedBigInteger('product_id')->nullable();
            $t->unsignedBigInteger('service_id')->nullable();
            $t->string('custom_description')->nullable(); // caso não tenha produto/serviço cadastrado
            $t->decimal('quantity', 10, 2)->default(1);
            $t->decimal('original_price', 12, 2); // preço tabelado
            $t->decimal('unit_price', 12, 2); // preço editado
            $t->decimal('discount_percentage', 5, 2)->default(0);
            $t->decimal('subtotal', 12, 2)->default(0);
            $t->integer('sort_order')->default(0);
            $t->timestamps();

            $t->foreign('quote_equipment_id')->references('id')->on('quote_equipments')->cascadeOnDelete();
            $t->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $t->foreign('service_id')->references('id')->on('services')->nullOnDelete();
        });

        Schema::create('quote_photos', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('quote_equipment_id')->nullable();
            $t->unsignedBigInteger('quote_item_id')->nullable();
            $t->string('path');
            $t->string('caption')->nullable();
            $t->integer('sort_order')->default(0);
            $t->timestamps();

            $t->foreign('quote_equipment_id')->references('id')->on('quote_equipments')->cascadeOnDelete();
            $t->foreign('quote_item_id')->references('id')->on('quote_items')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_photos');
        Schema::dropIfExists('quote_items');
        Schema::dropIfExists('quote_equipments');
        Schema::dropIfExists('quotes');
    }
};
