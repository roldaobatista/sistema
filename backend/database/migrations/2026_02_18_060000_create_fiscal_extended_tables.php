<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Webhooks config per tenant
        Schema::create('fiscal_webhooks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('url');
            $table->json('events')->nullable();
            $table->string('secret', 64)->nullable();
            $table->boolean('active')->default(true);
            $table->integer('failure_count')->default(0);
            $table->timestamp('last_triggered_at')->nullable();
            $table->timestamps();

            $table->index('tenant_id');
        });

        // Scheduled emissions
        Schema::create('fiscal_scheduled_emissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // nfe, nfse
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('quote_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->constrained();
            $table->json('payload');
            $table->timestamp('scheduled_at');
            $table->string('status')->default('pending'); // pending, processing, completed, failed
            $table->foreignId('fiscal_note_id')->nullable()->constrained('fiscal_notes')->nullOnDelete();
            $table->text('error_message')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index('scheduled_at');
        });

        // Templates
        Schema::create('fiscal_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type'); // nfe, nfse
            $table->json('template_data');
            $table->integer('usage_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('tenant_id');
        });

        // Audit log
        Schema::create('fiscal_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fiscal_note_id')->nullable()->constrained('fiscal_notes')->nullOnDelete();
            $table->string('action'); // emitted, cancelled, corrected, emailed, downloaded, etc.
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'fiscal_note_id']);
            $table->index('created_at');
        });

        // Add parent_note_id and payment_data to fiscal_notes
        if (Schema::hasTable('fiscal_notes')) {
            Schema::table('fiscal_notes', function (Blueprint $table) {
                if (!Schema::hasColumn('fiscal_notes', 'parent_note_id')) {
                    $table->foreignId('parent_note_id')->nullable()
                        ->constrained('fiscal_notes')->nullOnDelete();
                }
                if (!Schema::hasColumn('fiscal_notes', 'payment_data')) {
                    $table->json('payment_data')->nullable();
                }
                if (!Schema::hasColumn('fiscal_notes', 'email_retry_count')) {
                    $table->integer('email_retry_count')->default(0);
                }
                if (!Schema::hasColumn('fiscal_notes', 'last_email_sent_at')) {
                    $table->timestamp('last_email_sent_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('fiscal_notes')) {
            Schema::table('fiscal_notes', function (Blueprint $table) {
                if (Schema::hasColumn('fiscal_notes', 'parent_note_id')) {
                    $table->dropConstrainedForeignId('parent_note_id');
                }

                $cols = ['payment_data', 'email_retry_count', 'last_email_sent_at'];
                $existing = array_filter($cols, fn ($col) => Schema::hasColumn('fiscal_notes', $col));
                if (!empty($existing)) {
                    $table->dropColumn($existing);
                }
            });
        }
        Schema::dropIfExists('fiscal_audit_logs');
        Schema::dropIfExists('fiscal_templates');
        Schema::dropIfExists('fiscal_scheduled_emissions');
        Schema::dropIfExists('fiscal_webhooks');
    }
};
