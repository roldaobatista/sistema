<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_transfers')) {
            Schema::table('stock_transfers', function (Blueprint $table) {
                if (!Schema::hasColumn('stock_transfers', 'to_user_id')) {
                    $table->foreignId('to_user_id')->nullable()->constrained('users')->onDelete('set null');
                }
                if (!Schema::hasColumn('stock_transfers', 'accepted_at')) {
                    $table->timestamp('accepted_at')->nullable();
                }
                if (!Schema::hasColumn('stock_transfers', 'accepted_by')) {
                    $table->foreignId('accepted_by')->nullable()->constrained('users')->onDelete('set null');
                }
                if (!Schema::hasColumn('stock_transfers', 'rejected_at')) {
                    $table->timestamp('rejected_at')->nullable();
                }
                if (!Schema::hasColumn('stock_transfers', 'rejected_by')) {
                    $table->foreignId('rejected_by')->nullable()->constrained('users')->onDelete('set null');
                }
                if (!Schema::hasColumn('stock_transfers', 'rejection_reason')) {
                    $table->string('rejection_reason', 500)->nullable();
                }
            });
        }

        if (!Schema::hasTable('used_stock_items')) {
            Schema::create('used_stock_items', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('work_order_id')->constrained('work_orders')->onDelete('cascade');
                $table->foreignId('work_order_item_id')->nullable()->constrained('work_order_items')->onDelete('set null');
                $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
                $table->foreignId('technician_warehouse_id')->constrained('warehouses')->onDelete('cascade');
                $table->decimal('quantity', 15, 4);
                $table->string('status', 30)->default('pending_return');
                $table->foreignId('reported_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamp('reported_at')->nullable();
                $table->string('disposition_type', 30)->nullable();
                $table->text('disposition_notes')->nullable();
                $table->foreignId('confirmed_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamp('confirmed_at')->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->index(['tenant_id', 'status'], 'used_stock_tenant_status_idx');
            });
        }

        if (!Schema::hasTable('returned_used_item_dispositions')) {
            Schema::create('returned_used_item_dispositions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('used_stock_item_id')->constrained('used_stock_items')->onDelete('cascade');
                $table->boolean('sent_for_repair')->default(false);
                $table->unsignedBigInteger('repair_provider_id')->nullable();
                $table->string('repair_provider_name', 150)->nullable();
                $table->timestamp('repair_sent_at')->nullable();
                $table->timestamp('repair_returned_at')->nullable();
                $table->boolean('will_discard')->default(false);
                $table->timestamp('discarded_at')->nullable();
                $table->text('disposition_notes')->nullable();
                $table->foreignId('registered_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamps();

                if (Schema::hasTable('suppliers')) {
                    $table->foreign('repair_provider_id')->references('id')->on('suppliers')->onDelete('set null');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('returned_used_item_dispositions')) {
            Schema::dropIfExists('returned_used_item_dispositions');
        }
        if (Schema::hasTable('used_stock_items')) {
            Schema::dropIfExists('used_stock_items');
        }
        if (Schema::hasTable('stock_transfers')) {
            Schema::table('stock_transfers', function (Blueprint $table) {
                if (Schema::hasColumn('stock_transfers', 'rejection_reason')) {
                    $table->dropColumn('rejection_reason');
                }
                if (Schema::hasColumn('stock_transfers', 'rejected_by')) {
                    $table->dropForeign(['rejected_by']);
                }
                if (Schema::hasColumn('stock_transfers', 'rejected_at')) {
                    $table->dropColumn('rejected_at');
                }
                if (Schema::hasColumn('stock_transfers', 'accepted_by')) {
                    $table->dropForeign(['accepted_by']);
                }
                if (Schema::hasColumn('stock_transfers', 'accepted_at')) {
                    $table->dropColumn('accepted_at');
                }
                if (Schema::hasColumn('stock_transfers', 'to_user_id')) {
                    $table->dropForeign(['to_user_id']);
                }
            });
        }
    }
};
