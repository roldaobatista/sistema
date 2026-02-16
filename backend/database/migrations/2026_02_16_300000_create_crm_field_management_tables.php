<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ═══════════════════════════════════════════════════════
        // 1. VISIT CHECKINS (Check-in/Check-out com GPS)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('visit_checkins')) {
            Schema::create('visit_checkins', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('activity_id')->nullable()->constrained('crm_activities')->onDelete('set null');
                $table->timestamp('checkin_at');
                $table->decimal('checkin_lat', 10, 7)->nullable();
                $table->decimal('checkin_lng', 10, 7)->nullable();
                $table->string('checkin_address')->nullable();
                $table->string('checkin_photo')->nullable();
                $table->timestamp('checkout_at')->nullable();
                $table->decimal('checkout_lat', 10, 7)->nullable();
                $table->decimal('checkout_lng', 10, 7)->nullable();
                $table->string('checkout_photo')->nullable();
                $table->integer('duration_minutes')->nullable();
                $table->decimal('distance_from_client_meters', 10, 2)->nullable();
                $table->string('status')->default('checked_in'); // checked_in, checked_out, cancelled
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'user_id', 'checkin_at'], 'visit_ck_tenant_user_idx');
                $table->index(['tenant_id', 'customer_id'], 'visit_ck_tenant_cust_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 2. VISIT ROUTES (Roteiro de Visitas)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('visit_routes')) {
            Schema::create('visit_routes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->date('route_date');
                $table->string('name')->nullable();
                $table->string('status')->default('planned'); // planned, in_progress, completed, cancelled
                $table->integer('total_stops')->default(0);
                $table->integer('completed_stops')->default(0);
                $table->decimal('total_distance_km', 10, 2)->nullable();
                $table->integer('estimated_duration_minutes')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'user_id', 'route_date'], 'visit_rt_tenant_user_dt_idx');
            });
        }

        if (!Schema::hasTable('visit_route_stops')) {
            Schema::create('visit_route_stops', function (Blueprint $table) {
                $table->id();
                $table->foreignId('visit_route_id')->constrained()->onDelete('cascade');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('checkin_id')->nullable()->constrained('visit_checkins')->onDelete('set null');
                $table->integer('stop_order');
                $table->string('status')->default('pending'); // pending, visited, skipped
                $table->integer('estimated_duration_minutes')->nullable();
                $table->string('objective')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['visit_route_id', 'stop_order'], 'vrs_route_order_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 3. VISIT REPORTS (Ata Estruturada de Visita)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('visit_reports')) {
            Schema::create('visit_reports', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('checkin_id')->nullable()->constrained('visit_checkins')->onDelete('set null');
                $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->onDelete('set null');
                $table->date('visit_date');
                $table->string('visit_type')->default('presencial'); // presencial, virtual
                $table->string('contact_name')->nullable();
                $table->string('contact_role')->nullable();
                $table->text('summary');
                $table->text('decisions')->nullable();
                $table->text('next_steps')->nullable();
                $table->string('overall_sentiment')->nullable(); // positive, neutral, negative
                $table->json('topics')->nullable(); // [{topic, discussed, notes}]
                $table->json('attachments')->nullable();
                $table->boolean('follow_up_scheduled')->default(false);
                $table->timestamp('next_contact_at')->nullable();
                $table->string('next_contact_type')->nullable(); // visita, ligacao, email, whatsapp
                $table->timestamps();
                $table->index(['tenant_id', 'customer_id'], 'vr_tenant_cust_idx');
                $table->index(['tenant_id', 'user_id', 'visit_date'], 'vr_tenant_user_date_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 4. CONTACT POLICIES (Política de Frequência)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('contact_policies')) {
            Schema::create('contact_policies', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name');
                $table->string('target_type'); // rating, segment, all
                $table->string('target_value')->nullable(); // A, B, supermercado, etc
                $table->integer('max_days_without_contact');
                $table->integer('warning_days_before')->default(7);
                $table->string('preferred_contact_type')->nullable();
                $table->boolean('is_active')->default(true);
                $table->integer('priority')->default(0);
                $table->timestamps();
                $table->index(['tenant_id', 'is_active'], 'cp_tenant_active_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 5. QUICK NOTES (Notas Rápidas)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('quick_notes')) {
            Schema::create('quick_notes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->onDelete('set null');
                $table->string('channel')->nullable(); // telefone, presencial, whatsapp, email
                $table->string('sentiment')->nullable(); // positive, neutral, negative
                $table->text('content');
                $table->boolean('is_pinned')->default(false);
                $table->json('tags')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'customer_id'], 'qn_tenant_cust_idx');
                $table->index(['tenant_id', 'user_id'], 'qn_tenant_user_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 6. COMMITMENTS (Compromissos/Promessas)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('commitments')) {
            Schema::create('commitments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('visit_report_id')->nullable()->constrained()->onDelete('set null');
                $table->foreignId('activity_id')->nullable()->constrained('crm_activities')->onDelete('set null');
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('responsible_type'); // us, client, both
                $table->string('responsible_name')->nullable();
                $table->date('due_date')->nullable();
                $table->string('status')->default('pending'); // pending, completed, overdue, cancelled
                $table->timestamp('completed_at')->nullable();
                $table->text('completion_notes')->nullable();
                $table->string('priority')->default('normal'); // low, normal, high, urgent
                $table->timestamps();
                $table->index(['tenant_id', 'status', 'due_date'], 'commit_tenant_status_due_idx');
                $table->index(['tenant_id', 'customer_id'], 'commit_tenant_cust_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 7. IMPORTANT DATES (Datas Importantes)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('important_dates')) {
            Schema::create('important_dates', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->string('title');
                $table->string('type'); // birthday, company_anniversary, contract_start, custom
                $table->date('date');
                $table->boolean('recurring_yearly')->default(true);
                $table->integer('remind_days_before')->default(7);
                $table->string('contact_name')->nullable();
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index(['tenant_id', 'date'], 'impdate_tenant_date_idx');
                $table->index(['tenant_id', 'customer_id'], 'impdate_tenant_cust_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 8. VISIT SURVEYS (Pesquisa Pós-Visita CSAT)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('visit_surveys')) {
            Schema::create('visit_surveys', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('checkin_id')->nullable()->constrained('visit_checkins')->onDelete('set null');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->string('token', 64)->unique();
                $table->integer('rating')->nullable(); // 1-5
                $table->text('comment')->nullable();
                $table->string('status')->default('pending'); // pending, answered, expired
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('answered_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'status'], 'vs_tenant_status_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 9. ACCOUNT PLANS (Plano de Ação por Cliente)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('account_plans')) {
            Schema::create('account_plans', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->foreignId('owner_id')->constrained('users')->onDelete('cascade');
                $table->string('title');
                $table->text('objective')->nullable();
                $table->string('status')->default('active'); // active, completed, paused, cancelled
                $table->date('start_date')->nullable();
                $table->date('target_date')->nullable();
                $table->decimal('revenue_target', 12, 2)->nullable();
                $table->decimal('revenue_current', 12, 2)->nullable();
                $table->integer('progress_percent')->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'customer_id'], 'ap_tenant_cust_idx');
                $table->index(['tenant_id', 'status'], 'ap_tenant_status_idx');
            });
        }

        if (!Schema::hasTable('account_plan_actions')) {
            Schema::create('account_plan_actions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('account_plan_id')->constrained()->onDelete('cascade');
                $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
                $table->string('title');
                $table->text('description')->nullable();
                $table->date('due_date')->nullable();
                $table->string('status')->default('pending'); // pending, in_progress, completed, cancelled
                $table->integer('sort_order')->default(0);
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->index(['account_plan_id', 'status'], 'apa_plan_status_idx');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 10. GAMIFICATION
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('gamification_badges')) {
            Schema::create('gamification_badges', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->string('icon')->nullable();
                $table->string('color')->nullable();
                $table->string('category'); // visits, deals, coverage, satisfaction, commitments
                $table->string('metric'); // visits_count, deals_won, coverage_percent, csat_avg, commitments_on_time
                $table->integer('threshold');
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index(['tenant_id', 'category'], 'gb_tenant_cat_idx');
            });
        }

        if (!Schema::hasTable('gamification_user_badges')) {
            Schema::create('gamification_user_badges', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('badge_id')->constrained('gamification_badges')->onDelete('cascade');
                $table->timestamp('earned_at');
                $table->timestamps();
                $table->unique(['user_id', 'badge_id'], 'gub_user_badge_uniq');
            });
        }

        if (!Schema::hasTable('gamification_scores')) {
            Schema::create('gamification_scores', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->string('period'); // 2026-02, 2026-W07, etc
                $table->string('period_type')->default('monthly'); // weekly, monthly
                $table->integer('visits_count')->default(0);
                $table->integer('deals_won')->default(0);
                $table->decimal('deals_value', 12, 2)->default(0);
                $table->integer('new_clients')->default(0);
                $table->integer('activities_count')->default(0);
                $table->decimal('coverage_percent', 5, 2)->default(0);
                $table->decimal('csat_avg', 3, 2)->default(0);
                $table->integer('commitments_on_time')->default(0);
                $table->integer('commitments_total')->default(0);
                $table->integer('total_points')->default(0);
                $table->integer('rank_position')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'user_id', 'period'], 'gs_tenant_user_period_uniq');
            });
        }

        // ═══════════════════════════════════════════════════════
        // 11. RFM SCORES (Classificação RFM)
        // ═══════════════════════════════════════════════════════
        if (!Schema::hasTable('customer_rfm_scores')) {
            Schema::create('customer_rfm_scores', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->foreignId('customer_id')->constrained()->onDelete('cascade');
                $table->integer('recency_score'); // 1-5
                $table->integer('frequency_score'); // 1-5
                $table->integer('monetary_score'); // 1-5
                $table->string('rfm_segment'); // champions, loyal, at_risk, hibernating, etc
                $table->integer('total_score');
                $table->date('last_purchase_date')->nullable();
                $table->integer('purchase_count')->default(0);
                $table->decimal('total_revenue', 12, 2)->default(0);
                $table->timestamp('calculated_at');
                $table->timestamps();
                $table->unique(['tenant_id', 'customer_id'], 'crfm_tenant_cust_uniq');
                $table->index(['tenant_id', 'rfm_segment'], 'crfm_tenant_seg_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_rfm_scores');
        Schema::dropIfExists('gamification_scores');
        Schema::dropIfExists('gamification_user_badges');
        Schema::dropIfExists('gamification_badges');
        Schema::dropIfExists('account_plan_actions');
        Schema::dropIfExists('account_plans');
        Schema::dropIfExists('visit_surveys');
        Schema::dropIfExists('important_dates');
        Schema::dropIfExists('commitments');
        Schema::dropIfExists('quick_notes');
        Schema::dropIfExists('contact_policies');
        Schema::dropIfExists('visit_reports');
        Schema::dropIfExists('visit_route_stops');
        Schema::dropIfExists('visit_routes');
        Schema::dropIfExists('visit_checkins');
    }
};
