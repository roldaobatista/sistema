<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 200 Features Batch 1: New tables for fleet, HR, quality, routes, automation, etc.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ─── FROTA & VEÍCULOS ────────────────────────────────────────
        if (!Schema::hasTable('fleet_vehicles')) {
            Schema::create('fleet_vehicles', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('plate', 10)->index();
                $table->string('brand', 100)->nullable();
                $table->string('model', 100)->nullable();
                $table->integer('year')->nullable();
                $table->string('color', 50)->nullable();
                $table->string('type', 50)->default('car'); // car, truck, motorcycle
                $table->string('fuel_type', 30)->default('flex'); // flex, diesel, gasoline, electric
                $table->integer('odometer_km')->default(0);
                $table->string('renavam', 20)->nullable();
                $table->string('chassis', 30)->nullable();
                $table->date('crlv_expiry')->nullable();
                $table->date('insurance_expiry')->nullable();
                $table->date('next_maintenance')->nullable();
                $table->date('tire_change_date')->nullable();
                $table->decimal('purchase_value', 12, 2)->nullable();
                $table->decimal('avg_fuel_consumption', 10, 2)->nullable()->comment('Km/L ou Km/m3');
                $table->decimal('cost_per_km', 10, 4)->nullable();
                $table->date('cnh_expiry_driver')->nullable();
                $table->foreignId('assigned_user_id')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->string('status', 30)->default('active'); // active, maintenance, inactive
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('vehicle_inspections')) {
            Schema::create('vehicle_inspections', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('fleet_vehicle_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('inspector_id')->constrained('users')->onUpdate('cascade')->onDelete('cascade');
                $table->date('inspection_date');
                $table->integer('odometer_km');
                $table->json('checklist_data')->nullable(); // tires, oil, lights, docs, etc.
                $table->string('status', 30)->default('ok'); // ok, issues_found, critical
                $table->text('observations')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('traffic_fines')) {
            Schema::create('traffic_fines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('fleet_vehicle_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('driver_id')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->date('fine_date');
                $table->string('infraction_code', 30)->nullable();
                $table->text('description')->nullable();
                $table->decimal('amount', 10, 2);
                $table->integer('points')->default(0);
                $table->string('status', 30)->default('pending'); // pending, paid, appealed, cancelled
                $table->date('due_date')->nullable();
                $table->timestamps();
            });
        }

        // ─── RH & EQUIPE ─────────────────────────────────────────────
        if (!Schema::hasTable('work_schedules')) {
            Schema::create('work_schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->date('date');
                $table->string('shift_type', 30)->default('normal'); // normal, overtime, off, vacation, sick
                $table->time('start_time')->nullable();
                $table->time('end_time')->nullable();
                $table->string('region', 100)->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'date']);
            });
        }

        if (!Schema::hasTable('time_clock_entries')) {
            Schema::create('time_clock_entries', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->timestamp('clock_in');
                $table->timestamp('clock_out')->nullable();
                $table->decimal('latitude_in', 10, 7)->nullable();
                $table->decimal('longitude_in', 10, 7)->nullable();
                $table->decimal('latitude_out', 10, 7)->nullable();
                $table->decimal('longitude_out', 10, 7)->nullable();
                $table->string('type', 30)->default('regular'); // regular, overtime, travel
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('trainings')) {
            Schema::create('trainings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('title');
                $table->string('institution')->nullable();
                $table->string('certificate_number', 100)->nullable();
                $table->date('completion_date')->nullable();
                $table->date('expiry_date')->nullable();
                $table->string('category', 50)->nullable(); // technical, safety, quality, management
                $table->integer('hours')->nullable();
                $table->string('status', 30)->default('completed'); // planned, in_progress, completed, expired
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('performance_reviews')) {
            Schema::create('performance_reviews', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('reviewer_id')->constrained('users')->onUpdate('cascade')->onDelete('cascade');
                $table->string('period', 20); // 2026-Q1, 2026-01, etc.
                $table->json('criteria_scores')->nullable(); // {technical: 8, punctuality: 9, ...}
                $table->decimal('overall_score', 4, 2)->nullable();
                $table->text('strengths')->nullable();
                $table->text('improvements')->nullable();
                $table->text('goals')->nullable();
                $table->string('status', 30)->default('draft'); // draft, submitted, acknowledged
                $table->timestamps();
            });
        }

        // ─── QUALIDADE & PROCEDIMENTOS ───────────────────────────────
        if (!Schema::hasTable('quality_procedures')) {
            Schema::create('quality_procedures', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('code', 30)->index();
                $table->string('title');
                $table->text('description')->nullable();
                $table->integer('revision')->default(1);
                $table->string('category', 50)->nullable(); // calibration, safety, operational
                $table->foreignId('approved_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->date('approved_at')->nullable();
                $table->date('next_review_date')->nullable();
                $table->string('status', 30)->default('active'); // draft, active, obsolete
                $table->longText('content')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('corrective_actions')) {
            Schema::create('corrective_actions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('type', 10)->default('corrective'); // corrective, preventive
                $table->string('source', 50); // calibration, complaint, audit, internal
                $table->morphs('sourceable'); // equipment_calibration, customer_complaint, etc.
                $table->text('nonconformity_description');
                $table->text('root_cause')->nullable();
                $table->text('action_plan')->nullable();
                $table->foreignId('responsible_id')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->date('deadline')->nullable();
                $table->date('completed_at')->nullable();
                $table->string('status', 30)->default('open'); // open, in_progress, completed, verified
                $table->text('verification_notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('customer_complaints')) {
            Schema::create('customer_complaints', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('work_order_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
                $table->foreignId('equipment_id')->nullable()->constrained('equipments')->onUpdate('cascade')->onDelete('set null');
                $table->text('description');
                $table->string('category', 50)->default('service'); // service, certificate, delay, billing
                $table->string('severity', 20)->default('medium'); // low, medium, high, critical
                $table->string('status', 30)->default('open'); // open, investigating, resolved, closed
                $table->text('resolution')->nullable();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->date('resolved_at')->nullable();
                $table->timestamps();
            });
        }

        // ─── SATISFAÇÃO / NPS ────────────────────────────────────────
        if (!Schema::hasTable('satisfaction_surveys')) {
            Schema::create('satisfaction_surveys', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('work_order_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
                $table->tinyInteger('nps_score')->nullable(); // 0-10
                $table->tinyInteger('service_rating')->nullable(); // 1-5
                $table->tinyInteger('technician_rating')->nullable(); // 1-5
                $table->tinyInteger('timeliness_rating')->nullable(); // 1-5
                $table->text('comment')->nullable();
                $table->string('channel', 30)->default('system'); // system, whatsapp, email, phone
                $table->timestamps();
            });
        }

        // ─── ROTAS & OTIMIZAÇÃO ──────────────────────────────────────
        if (!Schema::hasTable('route_plans')) {
            Schema::create('route_plans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('technician_id')->constrained('users')->onUpdate('cascade')->onDelete('cascade');
                $table->date('plan_date');
                $table->json('stops')->nullable(); // [{work_order_id, lat, lng, order, estimated_arrival}]
                $table->decimal('total_distance_km', 8, 2)->nullable();
                $table->integer('estimated_duration_min')->nullable();
                $table->string('status', 30)->default('planned'); // planned, in_progress, completed
                $table->timestamps();
            });
        }

        // ─── AUTOMAÇÕES & WEBHOOKS ───────────────────────────────────
        if (!Schema::hasTable('automation_rules')) {
            Schema::create('automation_rules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->string('trigger_event', 100); // work_order.completed, quote.approved, payment.received
                $table->json('conditions')->nullable(); // [{field, operator, value}]
                $table->json('actions')->nullable(); // [{type: 'send_email', params: {...}}]
                $table->boolean('is_active')->default(true);
                $table->integer('execution_count')->default(0);
                $table->timestamp('last_executed_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('webhooks')) {
            Schema::create('webhooks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->string('url');
                $table->json('events'); // ['work_order.created', 'payment.received']
                $table->string('secret', 100)->nullable();
                $table->boolean('is_active')->default(true);
                $table->integer('failure_count')->default(0);
                $table->timestamp('last_triggered_at')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('webhook_logs')) {
            Schema::create('webhook_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('webhook_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('event', 100);
                $table->json('payload')->nullable();
                $table->integer('response_status')->nullable();
                $table->text('response_body')->nullable();
                $table->integer('duration_ms')->nullable();
                $table->string('status', 20)->default('pending'); // pending, success, failed
                $table->timestamps();
            });
        }

        // ─── DOCUMENTOS DO CLIENTE ───────────────────────────────────
        if (!Schema::hasTable('customer_documents')) {
            Schema::create('customer_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('title');
                $table->string('type', 50)->default('other'); // contract, alvara, avcb, license, other
                $table->string('file_path');
                $table->string('file_name');
                $table->integer('file_size')->nullable();
                $table->date('expiry_date')->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('uploaded_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->timestamps();
            });
        }

        // ─── FOLLOW-UPS COMERCIAIS ───────────────────────────────────
        if (!Schema::hasTable('follow_ups')) {
            Schema::create('follow_ups', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->morphs('followable'); // quote, customer, crm_deal
                $table->foreignId('assigned_to')->constrained('users')->onUpdate('cascade')->onDelete('cascade');
                $table->dateTime('scheduled_at');
                $table->dateTime('completed_at')->nullable();
                $table->string('channel', 30)->default('phone'); // phone, whatsapp, email, visit
                $table->text('notes')->nullable();
                $table->string('result', 50)->nullable(); // interested, not_now, lost, converted
                $table->string('status', 20)->default('pending'); // pending, completed, overdue, cancelled
                $table->timestamps();
            });
        }

        // ─── RÉGUA DE COBRANÇA ───────────────────────────────────────
        if (!Schema::hasTable('collection_rules')) {
            Schema::create('collection_rules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->boolean('is_active')->default(true);
                $table->json('steps')->nullable(); // [{days_offset: -3, channel: 'email', template_id: 1}, ...]
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('collection_actions')) {
            Schema::create('collection_actions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('account_receivable_id')->constrained('accounts_receivable')->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('collection_rule_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
                $table->integer('step_index')->default(0);
                $table->string('channel', 30); // email, whatsapp, sms, phone
                $table->string('status', 20)->default('pending'); // pending, sent, failed
                $table->dateTime('scheduled_at');
                $table->dateTime('sent_at')->nullable();
                $table->text('response')->nullable();
                $table->timestamps();
            });
        }

        // ─── CENTRO DE CUSTO ─────────────────────────────────────────
        if (!Schema::hasTable('cost_centers')) {
            Schema::create('cost_centers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->string('code', 20)->nullable()->index();
                $table->foreignId('parent_id')->nullable()->constrained('cost_centers')->onUpdate('cascade')->onDelete('set null');
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // ─── TABELA DE PREÇOS POR REGIÃO ─────────────────────────────
        if (!Schema::hasTable('price_tables')) {
            Schema::create('price_tables', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->string('region', 100)->nullable();
                $table->string('customer_type', 50)->nullable(); // government, industry, commerce, agro
                $table->decimal('multiplier', 5, 4)->default(1.0000);
                $table->boolean('is_default')->default(false);
                $table->boolean('is_active')->default(true);
                $table->date('valid_from')->nullable();
                $table->date('valid_until')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('price_table_items')) {
            Schema::create('price_table_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('price_table_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->morphs('priceable'); // product or service
                $table->decimal('price', 12, 2);
                $table->timestamps();
            });
        }

        // ─── OS RATINGS (Avaliação pós-serviço) ──────────────────────
        if (!Schema::hasTable('work_order_ratings')) {
            Schema::create('work_order_ratings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('customer_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->tinyInteger('overall_rating'); // 1-5
                $table->tinyInteger('quality_rating')->nullable(); // 1-5
                $table->tinyInteger('punctuality_rating')->nullable(); // 1-5
                $table->text('comment')->nullable();
                $table->string('channel', 30)->default('link'); // link, whatsapp, phone
                $table->timestamps();
            });
        }

        // ─── INVENTÁRIO DE FERRAMENTAS ────────────────────────────────
        if (!Schema::hasTable('tool_inventories')) {
            Schema::create('tool_inventories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->string('serial_number', 50)->nullable();
                $table->string('category', 50)->nullable();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->foreignId('fleet_vehicle_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
                $table->date('calibration_due')->nullable();
                $table->string('status', 30)->default('available'); // available, in_use, maintenance, retired
                $table->decimal('value', 10, 2)->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        // ─── RELATÓRIOS AGENDADOS ────────────────────────────────────
        if (!Schema::hasTable('scheduled_reports')) {
            Schema::create('scheduled_reports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('report_type', 50); // financial, productivity, commissions, etc.
                $table->string('frequency', 20); // daily, weekly, monthly
                $table->json('recipients')->nullable(); // email addresses
                $table->json('filters')->nullable(); // report-specific filters
                $table->string('format', 10)->default('pdf'); // pdf, excel
                $table->boolean('is_active')->default(true);
                $table->date('last_sent_at')->nullable();
                $table->date('next_send_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_reports');
        Schema::dropIfExists('tool_inventories');
        Schema::dropIfExists('work_order_ratings');
        Schema::dropIfExists('price_table_items');
        Schema::dropIfExists('price_tables');
        Schema::dropIfExists('cost_centers');
        Schema::dropIfExists('collection_actions');
        Schema::dropIfExists('collection_rules');
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('customer_documents');
        Schema::dropIfExists('webhook_logs');
        Schema::dropIfExists('webhooks');
        Schema::dropIfExists('automation_rules');
        Schema::dropIfExists('route_plans');
        Schema::dropIfExists('satisfaction_surveys');
        Schema::dropIfExists('customer_complaints');
        Schema::dropIfExists('corrective_actions');
        Schema::dropIfExists('quality_procedures');
        Schema::dropIfExists('performance_reviews');
        Schema::dropIfExists('trainings');
        Schema::dropIfExists('time_clock_entries');
        Schema::dropIfExists('work_schedules');
        Schema::dropIfExists('traffic_fines');
        Schema::dropIfExists('vehicle_inspections');
        Schema::dropIfExists('fleet_vehicles');
    }
};
