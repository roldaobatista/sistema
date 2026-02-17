<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR Advanced Module — Wave 1 & 2 tables.
 * Upgrades time_clock_entries + creates geofence, journey, leave, document, onboarding tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ─── UPGRADE TIME CLOCK ENTRIES (Ponto Digital Avançado) ─────
        Schema::table('time_clock_entries', function (Blueprint $table) {
            $table->string('selfie_path')->nullable();
            $table->decimal('liveness_score', 3, 2)->nullable();
            $table->boolean('liveness_passed')->default(false);
            $table->unsignedBigInteger('geofence_location_id')->nullable();
            $table->integer('geofence_distance_meters')->nullable();
            $table->json('device_info')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('clock_method', 30)->default('selfie'); // selfie, qrcode, manual, auto_os
            $table->string('approval_status', 30)->default('auto_approved'); // auto_approved, pending, approved, rejected
            $table->foreignId('approved_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('work_order_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
        });

        // ─── GEOFENCE LOCATIONS ─────────────────────────────────────
        if (!Schema::hasTable('geofence_locations')) {
            Schema::create('geofence_locations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->decimal('latitude', 10, 7);
                $table->decimal('longitude', 10, 7);
                $table->integer('radius_meters')->default(200);
                $table->boolean('is_active')->default(true);
                $table->nullableMorphs('linked_entity'); // customer, branch, etc.
                $table->text('notes')->nullable();
                $table->timestamps();
            });

            // Now add FK to time_clock_entries
            Schema::table('time_clock_entries', function (Blueprint $table) {
                $table->foreign('geofence_location_id')
                    ->references('id')->on('geofence_locations')
                    ->onUpdate('cascade')->onDelete('set null');
            });
        }

        // ─── TIME CLOCK ADJUSTMENTS ─────────────────────────────────
        if (!Schema::hasTable('time_clock_adjustments')) {
            Schema::create('time_clock_adjustments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('time_clock_entry_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('requested_by')->constrained('users')->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('approved_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->timestamp('original_clock_in')->nullable();
                $table->timestamp('original_clock_out')->nullable();
                $table->timestamp('adjusted_clock_in')->nullable();
                $table->timestamp('adjusted_clock_out')->nullable();
                $table->text('reason');
                $table->string('status', 30)->default('pending'); // pending, approved, rejected
                $table->text('rejection_reason')->nullable();
                $table->timestamp('decided_at')->nullable();
                $table->timestamps();
            });
        }

        // ─── JOURNEY RULES (Regras de Jornada) ──────────────────────
        if (!Schema::hasTable('journey_rules')) {
            Schema::create('journey_rules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->decimal('daily_hours', 4, 2)->default(8.00);
                $table->decimal('weekly_hours', 5, 2)->default(44.00);
                $table->integer('overtime_weekday_pct')->default(50);
                $table->integer('overtime_weekend_pct')->default(100);
                $table->integer('overtime_holiday_pct')->default(100);
                $table->integer('night_shift_pct')->default(20);
                $table->time('night_start')->default('22:00');
                $table->time('night_end')->default('05:00');
                $table->boolean('uses_hour_bank')->default(false);
                $table->integer('hour_bank_expiry_months')->default(6);
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        // ─── JOURNEY ENTRIES (Cálculo diário de jornada) ────────────
        if (!Schema::hasTable('journey_entries')) {
            Schema::create('journey_entries', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->date('date');
                $table->foreignId('journey_rule_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
                $table->decimal('scheduled_hours', 5, 2)->default(0);
                $table->decimal('worked_hours', 5, 2)->default(0);
                $table->decimal('overtime_hours_50', 5, 2)->default(0);
                $table->decimal('overtime_hours_100', 5, 2)->default(0);
                $table->decimal('night_hours', 5, 2)->default(0);
                $table->decimal('absence_hours', 5, 2)->default(0);
                $table->decimal('hour_bank_balance', 7, 2)->default(0);
                $table->boolean('is_holiday')->default(false);
                $table->boolean('is_dsr')->default(false);
                $table->string('status', 30)->default('calculated'); // calculated, adjusted, locked
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'date']);
            });
        }

        // ─── HOLIDAYS (Feriados) ────────────────────────────────────
        if (!Schema::hasTable('holidays')) {
            Schema::create('holidays', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->date('date');
                $table->boolean('is_national')->default(true);
                $table->boolean('is_recurring')->default(false);
                $table->timestamps();
                $table->unique(['tenant_id', 'date']);
            });
        }

        // ─── LEAVE REQUESTS (Férias & Afastamentos) ─────────────────
        if (!Schema::hasTable('leave_requests')) {
            Schema::create('leave_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('type', 30); // vacation, medical, personal, maternity, paternity, bereavement, other
                $table->date('start_date');
                $table->date('end_date');
                $table->integer('days_count');
                $table->text('reason')->nullable();
                $table->string('document_path')->nullable();
                $table->string('status', 30)->default('pending'); // draft, pending, approved, rejected, cancelled
                $table->foreignId('approved_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->timestamp('approved_at')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->timestamps();
            });
        }

        // ─── VACATION BALANCES (Saldo de férias) ────────────────────
        if (!Schema::hasTable('vacation_balances')) {
            Schema::create('vacation_balances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->date('acquisition_start');
                $table->date('acquisition_end');
                $table->integer('total_days')->default(30);
                $table->integer('taken_days')->default(0);
                $table->integer('sold_days')->default(0); // abono pecuniário, max 10
                $table->integer('remaining_days')->storedAs('total_days - taken_days - sold_days');
                $table->date('deadline'); // data limite para gozo
                $table->string('status', 30)->default('accruing'); // accruing, available, partially_taken, taken, expired
                $table->timestamps();
            });
        }

        // ─── EMPLOYEE DOCUMENTS ─────────────────────────────────────
        if (!Schema::hasTable('employee_documents')) {
            Schema::create('employee_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('category', 50); // aso, nr, contract, license, certification, id_doc, other
                $table->string('name');
                $table->string('file_path');
                $table->date('expiry_date')->nullable();
                $table->date('issued_date')->nullable();
                $table->string('issuer')->nullable();
                $table->boolean('is_mandatory')->default(false);
                $table->string('status', 30)->default('valid'); // valid, expiring, expired, pending
                $table->text('notes')->nullable();
                $table->foreignId('uploaded_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->timestamps();
            });
        }

        // ─── ONBOARDING ─────────────────────────────────────────────
        if (!Schema::hasTable('onboarding_templates')) {
            Schema::create('onboarding_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('name');
                $table->string('type', 30)->default('admission'); // admission, dismissal
                $table->json('default_tasks')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('onboarding_checklists')) {
            Schema::create('onboarding_checklists', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->foreignId('onboarding_template_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->string('status', 30)->default('in_progress'); // in_progress, completed, cancelled
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('onboarding_checklist_items')) {
            Schema::create('onboarding_checklist_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('onboarding_checklist_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
                $table->string('title');
                $table->text('description')->nullable();
                $table->foreignId('responsible_id')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->foreignId('completed_by')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
                $table->integer('order')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('onboarding_checklist_items');
        Schema::dropIfExists('onboarding_checklists');
        Schema::dropIfExists('onboarding_templates');
        Schema::dropIfExists('employee_documents');
        Schema::dropIfExists('vacation_balances');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('holidays');
        Schema::dropIfExists('journey_entries');
        Schema::dropIfExists('journey_rules');
        Schema::dropIfExists('time_clock_adjustments');

        // Remove FK before dropping geofence_locations
        Schema::table('time_clock_entries', function (Blueprint $table) {
            $table->dropForeign(['geofence_location_id']);
        });
        Schema::dropIfExists('geofence_locations');

        // Remove added columns from time_clock_entries
        Schema::table('time_clock_entries', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['work_order_id']);
            $table->dropColumn([
                'selfie_path', 'liveness_score', 'liveness_passed',
                'geofence_location_id', 'geofence_distance_meters',
                'device_info', 'ip_address', 'clock_method',
                'approval_status', 'approved_by', 'rejection_reason',
                'work_order_id',
            ]);
        });
    }
};
