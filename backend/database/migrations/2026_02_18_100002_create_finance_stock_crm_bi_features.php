<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // #11 Collection Logs (Régua de Cobrança)
        if (!Schema::hasTable('collection_logs')) {
            Schema::create('collection_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('account_receivable_id')->constrained('accounts_receivable')->onDelete('cascade');
                $table->foreignId('collection_rule_id')->constrained()->onDelete('cascade');
                $table->string('channel');
                $table->string('status')->default('sent');
                $table->timestamps();
                $table->index(['tenant_id', 'created_at']);
            });
        }

        // #12B Partial Payments
        if (!Schema::hasTable('partial_payments')) {
            Schema::create('partial_payments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('account_receivable_id')->constrained('accounts_receivable')->onDelete('cascade');
                $table->decimal('amount', 15, 2);
                $table->date('payment_date');
                $table->string('payment_method')->nullable();
                $table->string('notes', 500)->nullable();
                $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
                $table->timestamps();
            });
        }

        // #18 Inventory Counts (Inventário Cíclico)
        if (!Schema::hasTable('inventory_counts')) {
            Schema::create('inventory_counts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('warehouse_id')->constrained()->onDelete('cascade');
                $table->string('status')->default('in_progress');
                $table->foreignId('started_by')->constrained('users');
                $table->integer('items_count')->default(0);
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('inventory_count_items')) {
            Schema::create('inventory_count_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('inventory_count_id')->constrained()->onDelete('cascade');
                $table->foreignId('product_id')->constrained()->onDelete('cascade');
                $table->decimal('system_quantity', 15, 4);
                $table->decimal('counted_quantity', 15, 4)->nullable();
                $table->foreignId('counted_by')->nullable()->constrained('users');
                $table->timestamp('counted_at')->nullable();
                $table->timestamps();
            });
        }

        // #22 Funnel Email Automations
        if (!Schema::hasTable('funnel_email_automations')) {
            Schema::create('funnel_email_automations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('pipeline_stage_id');
                $table->string('trigger'); // on_enter, on_exit, after_days
                $table->integer('trigger_days')->nullable();
                $table->string('subject');
                $table->text('body');
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index(['tenant_id', 'pipeline_stage_id']);
            });
        }

        // #31 Scheduled Report Exports
        if (!Schema::hasTable('scheduled_report_exports')) {
            Schema::create('scheduled_report_exports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('report_type');
                $table->string('format')->default('xlsx');
                $table->string('frequency'); // daily, weekly, monthly
                $table->json('recipients');
                $table->json('filters')->nullable();
                $table->boolean('is_active')->default(true);
                $table->foreignId('created_by')->constrained('users');
                $table->timestamp('last_sent_at')->nullable();
                $table->timestamps();
            });
        }

        // Additional columns on quotes for #24 (Signature)
        if (!Schema::hasColumn('quotes', 'signature_token')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->string('signature_token', 64)->nullable();
                $table->timestamp('signature_sent_at')->nullable();
                $table->timestamp('signed_at')->nullable();
                $table->string('signer_name')->nullable();
                $table->string('signer_document', 20)->nullable();
                $table->text('signature_data')->nullable();
                $table->string('signer_ip', 45)->nullable();
            });
        }

        // Additional columns on leads for #23 (Score) and #26 (Merge)
        if (Schema::hasTable('leads') && !Schema::hasColumn('leads', 'score_updated_at')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->timestamp('score_updated_at')->nullable();
                $table->foreignId('merged_into_id')->nullable();
            });
        }

        // #9B CNAB fields on account_receivables
        if (Schema::hasTable('account_receivables') && !Schema::hasColumn('account_receivables', 'cnab_import_date')) {
            Schema::table('account_receivables', function (Blueprint $table) {
                $table->timestamp('cnab_import_date')->nullable();
                $table->string('nosso_numero', 30)->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_logs');
        Schema::dropIfExists('partial_payments');
        Schema::dropIfExists('inventory_count_items');
        Schema::dropIfExists('inventory_counts');
        Schema::dropIfExists('funnel_email_automations');
        Schema::dropIfExists('scheduled_report_exports');
    }
};
