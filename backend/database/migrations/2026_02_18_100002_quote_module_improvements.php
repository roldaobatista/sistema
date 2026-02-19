<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Consolidated migration for all 30 Quote module improvements.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Quote Templates ──
        Schema::create('quote_templates', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->text('warranty_terms')->nullable();
            $t->text('payment_terms_text')->nullable();
            $t->text('general_conditions')->nullable();
            $t->text('delivery_terms')->nullable();
            $t->boolean('is_default')->default(false);
            $t->boolean('is_active')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->index(['tenant_id', 'is_active']);
        });

        // ── 30. Quote Emails Log ──
        Schema::create('quote_emails', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('quote_id');
            $t->unsignedBigInteger('sent_by')->nullable();
            $t->string('recipient_email');
            $t->string('recipient_name')->nullable();
            $t->string('subject');
            $t->string('status', 20)->default('sent'); // sent, delivered, failed
            $t->text('message_body')->nullable();
            $t->boolean('pdf_attached')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('quote_id')->references('id')->on('quotes')->cascadeOnDelete();
            $t->foreign('sent_by')->references('id')->on('users')->nullOnDelete();
            $t->index(['tenant_id', 'quote_id']);
        });

        // ── 18. Quote Tags ──
        Schema::create('quote_tags', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->string('color', 7)->default('#3b82f6');
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'name']);
        });

        Schema::create('quote_quote_tag', function (Blueprint $t) {
            $t->unsignedBigInteger('quote_id');
            $t->unsignedBigInteger('quote_tag_id');
            $t->primary(['quote_id', 'quote_tag_id']);

            $t->foreign('quote_id')->references('id')->on('quotes')->cascadeOnDelete();
            $t->foreign('quote_tag_id')->references('id')->on('quote_tags')->cascadeOnDelete();
        });

        // ── Improvements on quotes table (guards para idempotência em produção) ──
        Schema::table('quotes', function (Blueprint $t) {
            if (!Schema::hasColumn('quotes', 'payment_terms')) {
                $t->string('payment_terms', 50)->nullable();
            }
            if (!Schema::hasColumn('quotes', 'payment_terms_detail')) {
                $t->text('payment_terms_detail')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'template_id')) {
                $t->unsignedBigInteger('template_id')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'is_template')) {
                $t->boolean('is_template')->default(false);
            }
            if (!Schema::hasColumn('quotes', 'opportunity_id')) {
                $t->unsignedBigInteger('opportunity_id')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'currency')) {
                $t->string('currency', 3)->default('BRL');
            }
            if (!Schema::hasColumn('quotes', 'last_followup_at')) {
                $t->timestamp('last_followup_at')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'followup_count')) {
                $t->unsignedSmallInteger('followup_count')->default(0);
            }
            if (!Schema::hasColumn('quotes', 'client_viewed_at')) {
                $t->timestamp('client_viewed_at')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'client_view_count')) {
                $t->unsignedSmallInteger('client_view_count')->default(0);
            }
            if (!Schema::hasColumn('quotes', 'level2_approved_by')) {
                $t->unsignedBigInteger('level2_approved_by')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'level2_approved_at')) {
                $t->timestamp('level2_approved_at')->nullable();
            }
            if (!Schema::hasColumn('quotes', 'custom_fields')) {
                $t->json('custom_fields')->nullable();
            }
        });

        if (Schema::hasColumn('quotes', 'template_id')) {
            try {
                Schema::table('quotes', function (Blueprint $t) {
                    $t->foreign('template_id')->references('id')->on('quote_templates')->nullOnDelete();
                });
            } catch (\Throwable $e) {
                $msg = $e->getMessage();
                if (!str_contains($msg, 'Duplicate') && !str_contains($msg, 'already exists')) {
                    throw $e;
                }
            }
        }

        // ── 5. Cost price on items + 17. Internal notes ──
        Schema::table('quote_items', function (Blueprint $t) {
            if (!Schema::hasColumn('quote_items', 'cost_price')) {
                $t->decimal('cost_price', 12, 2)->default(0);
            }
            if (!Schema::hasColumn('quote_items', 'internal_note')) {
                $t->text('internal_note')->nullable();
            }
        });

        // ── 23. Equipment optional (already nullable in migration) ──
        // equipment_id is already nullable in original migration, no change needed.

        // ── 29. Approval thresholds config ──
        Schema::create('quote_approval_thresholds', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->decimal('min_value', 12, 2)->default(0);
            $t->decimal('max_value', 12, 2)->nullable();
            $t->unsignedSmallInteger('required_level')->default(1); // 1 = manager, 2 = director
            $t->string('approver_role')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->index(['tenant_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('quote_items', function (Blueprint $t) {
            $cols = array_filter(['cost_price', 'internal_note'], fn ($c) => Schema::hasColumn('quote_items', $c));
            if ($cols) {
                $t->dropColumn($cols);
            }
        });

        if (Schema::hasTable('quotes')) {
            $fkExists = false;
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                $dbName = Schema::getConnection()->getDatabaseName();
                $fkExists = \Illuminate\Support\Facades\DB::selectOne(
                    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'quotes' AND CONSTRAINT_NAME = 'quotes_template_id_foreign'",
                    [$dbName]
                );
            } else {
                $fkExists = Schema::hasColumn('quotes', 'template_id');
            }
            Schema::table('quotes', function (Blueprint $t) use ($fkExists) {
                if ($fkExists) {
                    try {
                        $t->dropForeign(['template_id']);
                    } catch (\Throwable $e) {
                        // Idempotente: FK pode já ter sido removida em rollback anterior
                    }
                }
                $cols = [
                    'payment_terms', 'payment_terms_detail', 'template_id', 'is_template',
                    'opportunity_id', 'currency', 'last_followup_at', 'followup_count',
                    'client_viewed_at', 'client_view_count',
                    'level2_approved_by', 'level2_approved_at', 'custom_fields',
                ];
                $existing = array_filter($cols, fn ($c) => Schema::hasColumn('quotes', $c));
                if ($existing) {
                    $t->dropColumn($existing);
                }
            });
        }

        Schema::dropIfExists('quote_approval_thresholds');
        Schema::dropIfExists('quote_quote_tag');
        Schema::dropIfExists('quote_tags');
        Schema::dropIfExists('quote_emails');
        Schema::dropIfExists('quote_templates');
    }
};
