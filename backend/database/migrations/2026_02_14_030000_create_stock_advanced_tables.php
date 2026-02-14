<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchase_quotations')) {
            Schema::create('purchase_quotations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('supplier_id')->constrained()->onDelete('cascade');
                $table->decimal('total', 12, 2)->default(0);
                $table->string('status')->default('pending');
                $table->text('notes')->nullable();
                $table->date('valid_until')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('purchase_quotation_items')) {
            Schema::create('purchase_quotation_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('purchase_quotation_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->decimal('quantity', 12, 4);
                $table->decimal('unit_price', 12, 2);
                $table->decimal('total', 12, 2);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('stock_transfers')) {
            Schema::create('stock_transfers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('from_warehouse_id')->constrained('warehouses')->onDelete('cascade');
                $table->foreignId('to_warehouse_id')->constrained('warehouses')->onDelete('cascade');
                $table->string('status')->default('pending');
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('stock_transfer_items')) {
            Schema::create('stock_transfer_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('stock_transfer_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->decimal('quantity', 12, 4);
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasTable('serial_numbers')) {
            Schema::create('serial_numbers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->string('serial', 100);
                $table->string('status')->default('available');
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->unique(['tenant_id', 'serial']);
            });
        }

        if (!Schema::hasTable('material_requests')) {
            Schema::create('material_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->unsignedBigInteger('requested_by');
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->string('status')->default('pending');
                $table->string('urgency')->default('normal');
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('material_request_items')) {
            Schema::create('material_request_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('material_request_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->decimal('quantity', 12, 4);
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasTable('rma_requests')) {
            Schema::create('rma_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->string('serial_number', 100)->nullable();
                $table->unsignedBigInteger('customer_id')->nullable();
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->string('reason', 500);
                $table->integer('quantity')->default(1);
                $table->string('action')->default('replace');
                $table->string('status')->default('open');
                $table->text('resolution_notes')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('asset_tags')) {
            Schema::create('asset_tags', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->string('tag_code', 100)->unique();
                $table->string('tag_type')->default('qr');
                $table->string('location')->nullable();
                $table->timestamp('last_scanned_at')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('ecological_disposals')) {
            Schema::create('ecological_disposals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->decimal('quantity', 12, 4);
                $table->string('disposal_method');
                $table->string('disposal_company')->nullable();
                $table->string('certificate_number', 100)->nullable();
                $table->string('reason', 500);
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('disposed_by')->nullable();
                $table->timestamp('disposed_at')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ecological_disposals');
        Schema::dropIfExists('asset_tags');
        Schema::dropIfExists('rma_requests');
        Schema::dropIfExists('material_request_items');
        Schema::dropIfExists('material_requests');
        Schema::dropIfExists('serial_numbers');
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('purchase_quotation_items');
        Schema::dropIfExists('purchase_quotations');
    }
};
