<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Lead Scoring Rules ─────────────────────────
        Schema::create('crm_lead_scoring_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('field');
            $table->string('operator');
            $table->string('value');
            $table->integer('points');
            $table->string('category')->default('demographic');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active']);
        });

        // ─── 2. Lead Scores (calculated) ───────────────────
        Schema::create('crm_lead_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->integer('total_score')->default(0);
            $table->json('score_breakdown')->nullable();
            $table->string('grade')->nullable();
            $table->timestamp('calculated_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'customer_id']);
        });

        // ─── 3. Sales Sequences (Cadences) ─────────────────
        Schema::create('crm_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->integer('total_steps')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('crm_sequence_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sequence_id')->constrained('crm_sequences')->cascadeOnDelete();
            $table->integer('step_order');
            $table->integer('delay_days')->default(0);
            $table->string('channel');
            $table->string('action_type');
            $table->foreignId('template_id')->nullable()->constrained('crm_message_templates')->nullOnDelete();
            $table->string('subject')->nullable();
            $table->text('body')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['sequence_id', 'step_order']);
        });

        Schema::create('crm_sequence_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sequence_id')->constrained('crm_sequences')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->integer('current_step')->default(0);
            $table->string('status')->default('active');
            $table->timestamp('next_action_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->string('pause_reason')->nullable();
            $table->foreignId('enrolled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'next_action_at']);
        });

        // ─── 4. Smart Alerts ───────────────────────────────
        Schema::create('crm_smart_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('priority')->default('medium');
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('pending');
            $table->json('metadata')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'priority']);
            $table->index(['tenant_id', 'type']);
        });

        // ─── 5. Loss Reasons (structured) ──────────────────
        Schema::create('crm_loss_reasons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('category')->default('other');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active']);
        });

        // ─── 6. Deal Competitors ───────────────────────────
        Schema::create('crm_deal_competitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('deal_id')->constrained('crm_deals')->cascadeOnDelete();
            $table->string('competitor_name');
            $table->decimal('competitor_price', 12, 2)->nullable();
            $table->text('strengths')->nullable();
            $table->text('weaknesses')->nullable();
            $table->string('outcome')->nullable();
            $table->timestamps();
        });

        // ─── 7. Territories ────────────────────────────────
        Schema::create('crm_territories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('regions')->nullable();
            $table->json('zip_code_ranges')->nullable();
            $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_active']);
        });

        Schema::create('crm_territory_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('territory_id')->constrained('crm_territories')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('member');
            $table->timestamps();

            $table->unique(['territory_id', 'user_id']);
        });

        // ─── 8. Sales Goals (Quotas) ──────────────────────
        Schema::create('crm_sales_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('territory_id')->nullable()->constrained('crm_territories')->nullOnDelete();
            $table->string('period_type')->default('monthly');
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('target_revenue', 14, 2)->default(0);
            $table->integer('target_deals')->default(0);
            $table->integer('target_new_customers')->default(0);
            $table->integer('target_activities')->default(0);
            $table->decimal('achieved_revenue', 14, 2)->default(0);
            $table->integer('achieved_deals')->default(0);
            $table->integer('achieved_new_customers')->default(0);
            $table->integer('achieved_activities')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'period_start']);
        });

        // ─── 9. Contract Renewals ──────────────────────────
        Schema::create('crm_contract_renewals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->date('contract_end_date');
            $table->integer('alert_days_before')->default(60);
            $table->string('status')->default('pending');
            $table->decimal('current_value', 12, 2)->default(0);
            $table->decimal('renewal_value', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('renewed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'contract_end_date']);
        });

        // ─── 10. Web Lead Forms ────────────────────────────
        Schema::create('crm_web_forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->json('fields');
            $table->foreignId('pipeline_id')->nullable()->constrained('crm_pipelines')->nullOnDelete();
            $table->foreignId('assign_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('sequence_id')->nullable()->constrained('crm_sequences')->nullOnDelete();
            $table->string('redirect_url')->nullable();
            $table->string('success_message')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('submissions_count')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('crm_web_form_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_id')->constrained('crm_web_forms')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->json('data');
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->timestamps();

            $table->index('form_id');
        });

        // ─── 11. Interactive Proposals ─────────────────────
        Schema::create('crm_interactive_proposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quote_id')->constrained('quotes')->cascadeOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->string('token', 64)->unique();
            $table->string('status')->default('sent');
            $table->integer('view_count')->default(0);
            $table->integer('time_spent_seconds')->default(0);
            $table->json('item_interactions')->nullable();
            $table->text('client_notes')->nullable();
            $table->string('client_signature')->nullable();
            $table->timestamp('first_viewed_at')->nullable();
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // ─── 12. Email/Proposal Tracking ───────────────────
        Schema::create('crm_tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('trackable_type');
            $table->unsignedBigInteger('trackable_id');
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->string('event_type');
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('location')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['trackable_type', 'trackable_id']);
            $table->index(['tenant_id', 'event_type']);
        });

        // ─── 13. Referral Program ──────────────────────────
        Schema::create('crm_referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('referrer_customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('referred_customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->string('referred_name');
            $table->string('referred_email')->nullable();
            $table->string('referred_phone')->nullable();
            $table->string('status')->default('pending');
            $table->string('reward_type')->nullable();
            $table->decimal('reward_value', 10, 2)->nullable();
            $table->boolean('reward_given')->default(false);
            $table->timestamp('converted_at')->nullable();
            $table->timestamp('reward_given_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['referrer_customer_id']);
        });

        // ─── 14. Commercial Calendar Events ────────────────
        Schema::create('crm_calendar_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type')->default('meeting');
            $table->timestamp('start_at');
            $table->timestamp('end_at');
            $table->boolean('all_day')->default(false);
            $table->string('location')->nullable();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
            $table->foreignId('activity_id')->nullable()->constrained('crm_activities')->nullOnDelete();
            $table->string('color')->nullable();
            $table->string('recurrence_rule')->nullable();
            $table->string('external_id')->nullable();
            $table->string('external_provider')->nullable();
            $table->json('reminders')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'start_at']);
        });

        // ─── 15. Forecast Snapshots ────────────────────────
        Schema::create('crm_forecast_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->date('snapshot_date');
            $table->string('period_type')->default('monthly');
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('pipeline_value', 14, 2)->default(0);
            $table->decimal('weighted_value', 14, 2)->default(0);
            $table->decimal('best_case', 14, 2)->default(0);
            $table->decimal('worst_case', 14, 2)->default(0);
            $table->decimal('committed', 14, 2)->default(0);
            $table->integer('deal_count')->default(0);
            $table->decimal('won_value', 14, 2)->default(0);
            $table->integer('won_count')->default(0);
            $table->json('by_stage')->nullable();
            $table->json('by_user')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'snapshot_date']);
        });

        // ─── Add fields to crm_deals for loss reasons ─────
        if (!Schema::hasColumn('crm_deals', 'loss_reason_id')) {
            Schema::table('crm_deals', function (Blueprint $table) {
                $table->foreignId('loss_reason_id')->nullable()
                    ->constrained('crm_loss_reasons')->nullOnDelete();
                $table->string('competitor_name')->nullable();
                $table->decimal('competitor_price', 12, 2)->nullable();
            });
        }

        // ─── Add territory to customers ────────────────────
        if (!Schema::hasColumn('customers', 'territory_id')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->foreignId('territory_id')->nullable()
                    ->constrained('crm_territories')->nullOnDelete();
                $table->integer('lead_score')->default(0);
                $table->string('lead_grade')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Remove added columns
        if (Schema::hasColumn('customers', 'territory_id')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropConstrainedForeignId('territory_id');
                $table->dropColumn(['lead_score', 'lead_grade']);
            });
        }

        if (Schema::hasColumn('crm_deals', 'loss_reason_id')) {
            Schema::table('crm_deals', function (Blueprint $table) {
                $table->dropConstrainedForeignId('loss_reason_id');
                $table->dropColumn(['competitor_name', 'competitor_price']);
            });
        }

        Schema::dropIfExists('crm_forecast_snapshots');
        Schema::dropIfExists('crm_calendar_events');
        Schema::dropIfExists('crm_referrals');
        Schema::dropIfExists('crm_tracking_events');
        Schema::dropIfExists('crm_interactive_proposals');
        Schema::dropIfExists('crm_web_form_submissions');
        Schema::dropIfExists('crm_web_forms');
        Schema::dropIfExists('crm_contract_renewals');
        Schema::dropIfExists('crm_sales_goals');
        Schema::dropIfExists('crm_territory_members');
        Schema::dropIfExists('crm_territories');
        Schema::dropIfExists('crm_deal_competitors');
        Schema::dropIfExists('crm_loss_reasons');
        Schema::dropIfExists('crm_smart_alerts');
        Schema::dropIfExists('crm_sequence_enrollments');
        Schema::dropIfExists('crm_sequence_steps');
        Schema::dropIfExists('crm_sequences');
        Schema::dropIfExists('crm_lead_scores');
        Schema::dropIfExists('crm_lead_scoring_rules');
    }
};
