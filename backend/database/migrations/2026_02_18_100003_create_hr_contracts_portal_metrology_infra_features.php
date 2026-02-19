<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // #34 On-Call Schedules (Escala Plantão)
        if (!Schema::hasTable('on_call_schedules')) {
            Schema::create('on_call_schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->date('date');
                $table->string('shift'); // morning, afternoon, night, full
                $table->timestamps();
                $table->unique(['tenant_id', 'date', 'shift']);
            });
        }

        // #35 Performance Reviews (Avaliação 360°)
        if (!Schema::hasTable('performance_reviews')) {
            Schema::create('performance_reviews', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade');
                $table->string('period');
                $table->json('scores');
                $table->decimal('average_score', 3, 2)->default(0);
                $table->text('comments')->nullable();
                $table->json('goals')->nullable();
                $table->timestamps();
            });
        }

        // #36 Onboarding Digital
        if (!Schema::hasTable('onboarding_templates')) {
            Schema::create('onboarding_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('name');
                $table->string('role');
                $table->json('steps');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('onboarding_processes')) {
            Schema::create('onboarding_processes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('template_id');
                $table->string('status')->default('in_progress');
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('onboarding_steps')) {
            Schema::create('onboarding_steps', function (Blueprint $table) {
                $table->id();
                $table->foreignId('onboarding_process_id')->constrained()->onDelete('cascade');
                $table->string('title');
                $table->text('description')->nullable();
                $table->date('due_date')->nullable();
                $table->integer('position')->default(0);
                $table->string('status')->default('pending');
                $table->timestamps();
            });
        }

        // #37 Training & Certifications
        if (!Schema::hasTable('training_courses')) {
            Schema::create('training_courses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('name');
                $table->text('description')->nullable();
                $table->integer('duration_hours');
                $table->integer('certification_validity_months')->nullable();
                $table->boolean('is_mandatory')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('training_enrollments')) {
            Schema::create('training_enrollments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('course_id');
                $table->string('status')->default('enrolled');
                $table->date('scheduled_date')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->decimal('score', 5, 2)->nullable();
                $table->string('certification_number')->nullable();
                $table->date('certification_expires_at')->nullable();
                $table->timestamps();
            });
        }

        // #40 Contract Addendums (Aditivos)
        if (!Schema::hasTable('contract_addendums')) {
            Schema::create('contract_addendums', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('contract_id');
                $table->string('type'); // value_change, scope_change, term_extension, cancellation
                $table->text('description');
                $table->decimal('new_value', 15, 2)->nullable();
                $table->date('new_end_date')->nullable();
                $table->date('effective_date');
                $table->string('status')->default('pending');
                $table->foreignId('created_by')->constrained('users');
                $table->foreignId('approved_by')->nullable()->constrained('users');
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
            });
        }

        // #38 Contract Adjustments (Reajuste)
        if (!Schema::hasTable('contract_adjustments')) {
            Schema::create('contract_adjustments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('contract_id');
                $table->decimal('old_value', 15, 2);
                $table->decimal('new_value', 15, 2);
                $table->decimal('index_rate', 8, 4);
                $table->date('effective_date');
                $table->foreignId('applied_by')->constrained('users');
                $table->timestamps();
            });
        }

        // #41 Contract Measurements (Medição)
        if (!Schema::hasTable('contract_measurements')) {
            Schema::create('contract_measurements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('contract_id');
                $table->string('period');
                $table->json('items');
                $table->decimal('total_accepted', 15, 2)->default(0);
                $table->decimal('total_rejected', 15, 2)->default(0);
                $table->text('notes')->nullable();
                $table->string('status')->default('pending_approval');
                $table->foreignId('created_by')->constrained('users');
                $table->timestamps();
            });
        }

        // #45 Non-Conformances (RNC)
        if (!Schema::hasTable('non_conformances')) {
            Schema::create('non_conformances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('number')->unique();
                $table->string('title');
                $table->text('description');
                $table->string('type'); // equipment, process, service, product
                $table->string('severity'); // minor, major, critical
                $table->unsignedBigInteger('equipment_id')->nullable();
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->text('corrective_action')->nullable();
                $table->text('root_cause')->nullable();
                $table->text('preventive_action')->nullable();
                $table->foreignId('responsible_id')->nullable()->constrained('users');
                $table->date('deadline')->nullable();
                $table->string('status')->default('open');
                $table->foreignId('reported_by')->constrained('users');
                $table->foreignId('closed_by')->nullable()->constrained('users');
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();
            });
        }

        // #47 Measurement Uncertainties (Incerteza)
        if (!Schema::hasTable('measurement_uncertainties')) {
            Schema::create('measurement_uncertainties', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('equipment_id');
                $table->unsignedBigInteger('calibration_id')->nullable();
                $table->string('measurement_type');
                $table->decimal('nominal_value', 15, 6);
                $table->decimal('mean_value', 15, 6);
                $table->decimal('std_deviation', 15, 6);
                $table->decimal('type_a_uncertainty', 15, 6);
                $table->decimal('combined_uncertainty', 15, 6);
                $table->decimal('expanded_uncertainty', 15, 6);
                $table->decimal('coverage_factor', 5, 2)->default(2);
                $table->string('unit', 20);
                $table->json('measured_values');
                $table->foreignId('created_by')->constrained('users');
                $table->timestamps();
            });
        }

        // #48 Recall Logs (Calibração)
        if (!Schema::hasTable('recall_logs')) {
            Schema::create('recall_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->unsignedBigInteger('equipment_id');
                $table->unsignedBigInteger('customer_id');
                $table->string('type');
                $table->string('status')->default('sent');
                $table->timestamp('created_at');
            });
        }

        // #49 Webhook Configs
        if (!Schema::hasTable('webhook_configs')) {
            Schema::create('webhook_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('name');
                $table->string('url', 500);
                $table->json('events');
                $table->string('secret');
                $table->json('headers')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('webhook_logs')) {
            Schema::create('webhook_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('webhook_config_id')->constrained()->onDelete('cascade');
                $table->string('event');
                $table->json('payload');
                $table->integer('response_code')->nullable();
                $table->text('response_body')->nullable();
                $table->boolean('success')->default(false);
                $table->timestamp('created_at');
            });
        }

        // #50 API Keys
        if (!Schema::hasTable('api_keys')) {
            Schema::create('api_keys', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('name');
                $table->string('key_hash', 64);
                $table->string('prefix', 16);
                $table->json('permissions');
                $table->date('expires_at')->nullable();
                $table->boolean('is_active')->default(true);
                $table->foreignId('created_by')->constrained('users');
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('revoked_at')->nullable();
                $table->timestamps();
                $table->index('key_hash');
            });
        }

        // Additional columns for contracts (#38/#39)
        if (Schema::hasTable('recurring_contracts') && !Schema::hasColumn('recurring_contracts', 'adjustment_index')) {
            Schema::table('recurring_contracts', function (Blueprint $table) {
                $table->string('adjustment_index')->nullable(); // IPCA, IGPM, etc.
                $table->date('next_adjustment_date')->nullable();
            });
        }

        // Calibration certificates verification (#46)
        if (Schema::hasTable('calibration_certificates') && !Schema::hasColumn('calibration_certificates', 'verification_code')) {
            Schema::table('calibration_certificates', function (Blueprint $table) {
                $table->string('verification_code', 36)->nullable()->unique();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('api_keys');
        Schema::dropIfExists('webhook_logs');
        Schema::dropIfExists('webhook_configs');
        Schema::dropIfExists('recall_logs');
        Schema::dropIfExists('measurement_uncertainties');
        Schema::dropIfExists('non_conformances');
        Schema::dropIfExists('contract_measurements');
        Schema::dropIfExists('contract_adjustments');
        Schema::dropIfExists('contract_addendums');
        Schema::dropIfExists('training_enrollments');
        Schema::dropIfExists('training_courses');
        Schema::dropIfExists('onboarding_steps');
        Schema::dropIfExists('onboarding_processes');
        Schema::dropIfExists('onboarding_templates');
        Schema::dropIfExists('performance_reviews');
        Schema::dropIfExists('on_call_schedules');
    }
};
