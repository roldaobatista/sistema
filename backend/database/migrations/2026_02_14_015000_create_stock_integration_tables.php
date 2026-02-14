<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ═══ Cotação de Compras ═══
        if (!Schema::hasTable('purchase_quotes')) {
            Schema::create('purchase_quotes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('reference', 30)->unique();
                $table->string('title');
                $table->text('notes')->nullable();
                $table->enum('status', ['draft', 'sent', 'received', 'approved', 'rejected', 'cancelled'])->default('draft');
                $table->date('deadline')->nullable();
                $table->unsignedBigInteger('approved_supplier_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('purchase_quote_items')) {
            Schema::create('purchase_quote_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('purchase_quote_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('restrict');
                $table->decimal('quantity', 12, 2);
                $table->string('unit', 20)->nullable();
                $table->text('specifications')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('purchase_quote_suppliers')) {
            Schema::create('purchase_quote_suppliers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('purchase_quote_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('supplier_id');
                $table->enum('status', ['pending', 'responded', 'declined'])->default('pending');
                $table->decimal('total_price', 15, 2)->nullable();
                $table->integer('delivery_days')->nullable();
                $table->text('conditions')->nullable();
                $table->json('item_prices')->nullable();
                $table->timestamp('responded_at')->nullable();
                $table->timestamps();
            });
        }

        // ═══ Solicitação de Material ═══
        if (!Schema::hasTable('material_requests')) {
            Schema::create('material_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('reference', 30)->unique();
                $table->foreignId('requester_id')->constrained('users')->onDelete('restrict');
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->unsignedBigInteger('warehouse_id')->nullable();
                $table->enum('status', ['pending', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected', 'cancelled'])->default('pending');
                $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
                $table->text('justification')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('material_request_items')) {
            Schema::create('material_request_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('material_request_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('restrict');
                $table->decimal('quantity_requested', 12, 2);
                $table->decimal('quantity_fulfilled', 12, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ═══ Tags RFID/QR ═══
        if (!Schema::hasTable('asset_tags')) {
            Schema::create('asset_tags', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('tag_code', 100)->unique();
                $table->enum('tag_type', ['rfid', 'qrcode', 'barcode'])->default('qrcode');
                $table->morphs('taggable'); // product_id, equipment_id, etc.
                $table->enum('status', ['active', 'inactive', 'lost', 'damaged'])->default('active');
                $table->string('location')->nullable();
                $table->timestamp('last_scanned_at')->nullable();
                $table->unsignedBigInteger('last_scanned_by')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('asset_tag_scans')) {
            Schema::create('asset_tag_scans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('asset_tag_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('scanned_by');
                $table->string('action', 50)->default('scan');
                $table->string('location')->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        // ═══ RMA (Devolução) ═══
        if (!Schema::hasTable('rma_requests')) {
            Schema::create('rma_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('rma_number', 30)->unique();
                $table->unsignedBigInteger('customer_id')->nullable();
                $table->unsignedBigInteger('supplier_id')->nullable();
                $table->enum('type', ['customer_return', 'supplier_return'])->default('customer_return');
                $table->enum('status', ['requested', 'approved', 'in_transit', 'received', 'inspected', 'resolved', 'rejected'])->default('requested');
                $table->text('reason');
                $table->text('resolution_notes')->nullable();
                $table->enum('resolution', ['refund', 'replacement', 'repair', 'credit', 'rejected'])->nullable();
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('rma_items')) {
            Schema::create('rma_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('rma_request_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('restrict');
                $table->decimal('quantity', 12, 2);
                $table->text('defect_description')->nullable();
                $table->enum('condition', ['new', 'used', 'damaged', 'defective'])->default('defective');
                $table->timestamps();
            });
        }

        // ═══ Descarte Ecológico ═══
        if (!Schema::hasTable('stock_disposals')) {
            Schema::create('stock_disposals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('reference', 30)->unique();
                $table->enum('disposal_type', ['expired', 'damaged', 'obsolete', 'recalled', 'hazardous', 'other'])->default('other');
                $table->enum('disposal_method', ['recycling', 'incineration', 'landfill', 'donation', 'return_manufacturer', 'specialized_treatment'])->default('recycling');
                $table->enum('status', ['pending', 'approved', 'in_progress', 'completed', 'cancelled'])->default('pending');
                $table->text('justification');
                $table->text('environmental_notes')->nullable();
                $table->string('disposal_certificate')->nullable();
                $table->unsignedBigInteger('warehouse_id')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('stock_disposal_items')) {
            Schema::create('stock_disposal_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('stock_disposal_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('restrict');
                $table->decimal('quantity', 12, 2);
                $table->decimal('unit_cost', 15, 4)->default(0);
                $table->unsignedBigInteger('batch_id')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_disposal_items');
        Schema::dropIfExists('stock_disposals');
        Schema::dropIfExists('rma_items');
        Schema::dropIfExists('rma_requests');
        Schema::dropIfExists('asset_tag_scans');
        Schema::dropIfExists('asset_tags');
        Schema::dropIfExists('material_request_items');
        Schema::dropIfExists('material_requests');
        Schema::dropIfExists('purchase_quote_suppliers');
        Schema::dropIfExists('purchase_quote_items');
        Schema::dropIfExists('purchase_quotes');
    }
};
