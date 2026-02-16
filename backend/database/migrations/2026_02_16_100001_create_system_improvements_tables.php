<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Skill Matrix (Técnicos) ──────────────────────
        if (!Schema::hasTable('technician_skills')) {
            Schema::create('technician_skills', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('skill_name');
                $table->string('category')->default('general');
                $table->integer('proficiency_level')->default(1);
                $table->string('certification')->nullable();
                $table->date('certified_at')->nullable();
                $table->date('expires_at')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'user_id']);
                $table->index(['tenant_id', 'skill_name']);
            });
        }

        // ─── Collection Rules (Régua de Cobrança) ─────────
        if (!Schema::hasTable('collection_rules')) {
            Schema::create('collection_rules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->integer('days_offset');
                $table->string('channel');
                $table->string('template_type')->default('reminder');
                $table->foreignId('template_id')->nullable();
                $table->text('message_body')->nullable();
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->timestamps();

                $table->index(['tenant_id', 'is_active']);
            });
        }

        // ─── Collection Actions Log ───────────────────────
        if (!Schema::hasTable('collection_action_logs')) {
            Schema::create('collection_action_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('receivable_id')->constrained('accounts_receivable')->cascadeOnDelete();
                $table->foreignId('rule_id')->nullable()->constrained('collection_rules')->nullOnDelete();
                $table->string('channel');
                $table->string('status')->default('sent');
                $table->text('message')->nullable();
                $table->string('error')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'receivable_id']);
            });
        }

        // ─── Purchase Auto Orders (Compra automática) ─────
        if (!Schema::hasTable('auto_purchase_rules')) {
            Schema::create('auto_purchase_rules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->integer('min_stock')->default(0);
                $table->integer('reorder_quantity')->default(1);
                $table->foreignId('preferred_supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
                $table->boolean('is_active')->default(true);
                $table->timestamp('last_triggered_at')->nullable();
                $table->timestamps();

                $table->unique(['tenant_id', 'product_id']);
            });
        }

        // ─── Stock Demand Forecast ────────────────────────
        if (!Schema::hasTable('stock_demand_forecasts')) {
            Schema::create('stock_demand_forecasts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->date('forecast_date');
                $table->integer('predicted_demand')->default(0);
                $table->integer('scheduled_os_count')->default(0);
                $table->integer('current_stock')->default(0);
                $table->integer('deficit')->default(0);
                $table->timestamps();

                $table->index(['tenant_id', 'forecast_date']);
            });
        }

        // ─── Quality CAPA (Corrective/Preventive Actions) ─
        if (!Schema::hasTable('capa_records')) {
            Schema::create('capa_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('type')->default('corrective');
                $table->string('source');
                $table->unsignedBigInteger('source_id')->nullable();
                $table->string('title');
                $table->text('description')->nullable();
                $table->text('root_cause')->nullable();
                $table->text('corrective_action')->nullable();
                $table->text('preventive_action')->nullable();
                $table->text('verification')->nullable();
                $table->string('status')->default('open');
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->date('due_date')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->string('effectiveness')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'status']);
            });
        }

        // ─── Global Search Index ──────────────────────────
        if (!Schema::hasTable('search_index')) {
            Schema::create('search_index', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('searchable_type');
                $table->unsignedBigInteger('searchable_id');
                $table->string('title');
                $table->text('content')->nullable();
                $table->string('module');
                $table->string('url')->nullable();
                $table->timestamp('indexed_at');

                $table->index(['tenant_id', 'searchable_type', 'searchable_id']);
                $table->fullText(['title', 'content']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('search_index');
        Schema::dropIfExists('capa_records');
        Schema::dropIfExists('stock_demand_forecasts');
        Schema::dropIfExists('auto_purchase_rules');
        Schema::dropIfExists('collection_action_logs');
        Schema::dropIfExists('collection_rules');
        Schema::dropIfExists('technician_skills');
    }
};
