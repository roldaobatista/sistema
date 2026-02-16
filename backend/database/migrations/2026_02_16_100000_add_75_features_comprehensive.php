<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration — Funcionalidades genuinamente novas (sem duplicar o que já existe).
 *
 * Tabelas NOVAS:
 *   - calibration_readings, excentricity_tests, certificate_templates
 *   - whatsapp_configs, debt_renegotiations, debt_renegotiation_items
 *   - payment_receipts, weight_assignments, tool_calibrations
 *   - quality_audits, quality_audit_items, document_versions
 *   - system_alerts, alert_configurations
 *
 * Colunas adicionadas em tabelas existentes:
 *   - equipment_calibrations, standard_weights, work_orders, equipments, customers
 */
return new class extends Migration
{
    public function up(): void
    {
        // ═══════════════════════════════════════════════════════════════
        // CALIBRAÇÃO — Leituras estruturadas (substituem JSON genérico)
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasTable('calibration_readings')) {
            Schema::create('calibration_readings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('equipment_calibration_id')->constrained()->cascadeOnDelete();
                $table->decimal('reference_value', 12, 4);
                $table->decimal('indication_increasing', 12, 4)->nullable();
                $table->decimal('indication_decreasing', 12, 4)->nullable();
                $table->decimal('error', 12, 4)->nullable();
                $table->decimal('expanded_uncertainty', 12, 4)->nullable();
                $table->decimal('k_factor', 6, 2)->default(2.00);
                $table->decimal('correction', 12, 4)->nullable();
                $table->integer('reading_order')->default(0);
                $table->integer('repetition')->default(1);
                $table->string('unit', 10)->default('kg');
                $table->timestamps();
                $table->index(['equipment_calibration_id', 'reading_order']);
            });
        }

        if (!Schema::hasTable('excentricity_tests')) {
            Schema::create('excentricity_tests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('equipment_calibration_id')->constrained()->cascadeOnDelete();
                $table->string('position', 50);
                $table->decimal('load_applied', 12, 4);
                $table->decimal('indication', 12, 4);
                $table->decimal('error', 12, 4)->nullable();
                $table->decimal('max_permissible_error', 12, 4)->nullable();
                $table->boolean('conforms')->nullable();
                $table->integer('position_order')->default(0);
                $table->timestamps();
                $table->index('equipment_calibration_id');
            });
        }

        if (!Schema::hasTable('certificate_templates')) {
            Schema::create('certificate_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('type')->default('calibration');
                $table->text('header_html')->nullable();
                $table->text('footer_html')->nullable();
                $table->string('logo_path')->nullable();
                $table->string('signature_image_path')->nullable();
                $table->string('signatory_name')->nullable();
                $table->string('signatory_title')->nullable();
                $table->string('signatory_registration')->nullable();
                $table->json('custom_fields')->nullable();
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('calibration_standard_weight')) {
            Schema::create('calibration_standard_weight', function (Blueprint $table) {
                $table->id();
                $table->foreignId('equipment_calibration_id')->constrained()->cascadeOnDelete();
                $table->foreignId('standard_weight_id')->constrained()->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['equipment_calibration_id', 'standard_weight_id'], 'cal_sw_unique');
            });
        }

        // Colunas extras no EquipmentCalibration
        if (!Schema::hasColumn('equipment_calibrations', 'certificate_template_id')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $table->foreignId('certificate_template_id')->nullable()->after('work_order_id');
                $table->string('conformity_declaration')->nullable()->after('eccentricity_data');
                $table->decimal('max_permissible_error', 12, 4)->nullable()->after('conformity_declaration');
                $table->decimal('max_error_found', 12, 4)->nullable()->after('max_permissible_error');
                $table->string('mass_unit', 10)->default('kg')->after('max_error_found');
                $table->string('calibration_method')->nullable()->after('mass_unit');
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // COMUNICAÇÃO — Configuração WhatsApp (mensagens já existem)
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasTable('whatsapp_configs')) {
            Schema::create('whatsapp_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('provider')->default('evolution');
                $table->string('api_url');
                $table->string('api_key');
                $table->string('instance_name')->nullable();
                $table->string('phone_number')->nullable();
                $table->boolean('is_active')->default(true);
                $table->json('settings')->nullable();
                $table->timestamps();
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // FINANCEIRO — Renegociação de dívida + Recibos
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasTable('debt_renegotiations')) {
            Schema::create('debt_renegotiations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
                $table->decimal('original_total', 14, 2);
                $table->decimal('negotiated_total', 14, 2);
                $table->decimal('discount_amount', 14, 2)->default(0);
                $table->decimal('interest_amount', 14, 2)->default(0);
                $table->decimal('fine_amount', 14, 2)->default(0);
                $table->integer('new_installments')->default(1);
                $table->date('first_due_date');
                $table->text('notes')->nullable();
                $table->string('status')->default('pending');
                $table->foreignId('created_by')->constrained('users');
                $table->foreignId('approved_by')->nullable()->constrained('users');
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('debt_renegotiation_items')) {
            Schema::create('debt_renegotiation_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('debt_renegotiation_id')->constrained()->cascadeOnDelete();
                $table->foreignId('account_receivable_id')->constrained('accounts_receivable')->cascadeOnDelete();
                $table->decimal('original_amount', 14, 2);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('payment_receipts')) {
            Schema::create('payment_receipts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
                $table->string('receipt_number');
                $table->string('pdf_path')->nullable();
                $table->foreignId('generated_by')->constrained('users');
                $table->timestamps();
                $table->unique(['tenant_id', 'receipt_number']);
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // LOGÍSTICA — Checkin/Checkout geolocalizado na OS
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasColumn('work_orders', 'checkin_at')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->timestamp('checkin_at')->nullable()->after('dispatch_authorized_at');
                $table->decimal('checkin_lat', 10, 7)->nullable()->after('checkin_at');
                $table->decimal('checkin_lng', 10, 7)->nullable()->after('checkin_lat');
                $table->timestamp('checkout_at')->nullable()->after('checkin_lng');
                $table->decimal('checkout_lat', 10, 7)->nullable()->after('checkout_at');
                $table->decimal('checkout_lng', 10, 7)->nullable()->after('checkout_lat');
                $table->integer('eta_minutes')->nullable()->after('checkout_lng');
                $table->decimal('auto_km_calculated', 10, 2)->nullable()->after('eta_minutes');
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // PORTAL — QR Token nos equipamentos
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasColumn('equipments', 'qr_token')) {
            Schema::table('equipments', function (Blueprint $table) {
                $table->string('qr_token', 64)->nullable()->unique()->after('status');
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // ESTOQUE — Atribuição de pesos + Calibração de ferramentas
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasTable('weight_assignments')) {
            Schema::create('weight_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('standard_weight_id')->constrained()->cascadeOnDelete();
                $table->foreignId('assigned_to_user_id')->nullable()->constrained('users');
                $table->foreignId('assigned_to_vehicle_id')->nullable()->constrained('fleet_vehicles');
                $table->string('assignment_type')->default('field');
                $table->timestamp('assigned_at');
                $table->timestamp('returned_at')->nullable();
                $table->foreignId('assigned_by')->constrained('users');
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'standard_weight_id']);
            });
        }

        if (!Schema::hasColumn('standard_weights', 'assigned_to_vehicle_id')) {
            Schema::table('standard_weights', function (Blueprint $table) {
                $table->foreignId('assigned_to_vehicle_id')->nullable()->after('notes');
                $table->foreignId('assigned_to_user_id')->nullable()->after('assigned_to_vehicle_id');
                $table->string('current_location')->nullable()->after('assigned_to_user_id');
            });
        }

        if (!Schema::hasTable('tool_calibrations')) {
            Schema::create('tool_calibrations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('tool_inventory_id')->constrained('tool_inventories')->cascadeOnDelete();
                $table->date('calibration_date');
                $table->date('next_due_date');
                $table->string('certificate_number')->nullable();
                $table->string('laboratory')->nullable();
                $table->string('result')->default('approved');
                $table->string('certificate_file')->nullable();
                $table->decimal('cost', 10, 2)->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['tool_inventory_id', 'next_due_date']);
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // QUALIDADE ISO — Auditorias + Documentos versionados
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasTable('quality_audits')) {
            Schema::create('quality_audits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('audit_number');
                $table->string('title');
                $table->string('type')->default('internal');
                $table->string('scope')->nullable();
                $table->date('planned_date');
                $table->date('executed_date')->nullable();
                $table->foreignId('auditor_id')->constrained('users');
                $table->string('status')->default('planned');
                $table->text('summary')->nullable();
                $table->integer('non_conformities_found')->default(0);
                $table->integer('observations_found')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('quality_audit_items')) {
            Schema::create('quality_audit_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('quality_audit_id')->constrained()->cascadeOnDelete();
                $table->string('requirement');
                $table->string('clause')->nullable();
                $table->text('question');
                $table->string('result')->nullable();
                $table->text('evidence')->nullable();
                $table->text('notes')->nullable();
                $table->integer('item_order')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('document_versions')) {
            Schema::create('document_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('document_code');
                $table->string('title');
                $table->string('category');
                $table->string('version', 20);
                $table->text('description')->nullable();
                $table->string('file_path')->nullable();
                $table->string('status')->default('draft');
                $table->foreignId('created_by')->constrained('users');
                $table->foreignId('approved_by')->nullable()->constrained('users');
                $table->timestamp('approved_at')->nullable();
                $table->date('effective_date')->nullable();
                $table->date('review_date')->nullable();
                $table->timestamps();
                $table->softDeletes();
                $table->index(['tenant_id', 'document_code']);
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // ALERTAS — Motor de alertas configuráveis
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasTable('system_alerts')) {
            Schema::create('system_alerts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('alert_type');
                $table->string('severity')->default('medium');
                $table->string('title');
                $table->text('message');
                $table->nullableMorphs('alertable');
                $table->json('channels_sent')->nullable();
                $table->string('status')->default('active');
                $table->foreignId('acknowledged_by')->nullable()->constrained('users');
                $table->timestamp('acknowledged_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'alert_type', 'status']);
            });
        }

        if (!Schema::hasTable('alert_configurations')) {
            Schema::create('alert_configurations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->string('alert_type');
                $table->boolean('is_enabled')->default(true);
                $table->json('channels')->default('["system"]');
                $table->integer('days_before')->nullable();
                $table->string('cron_expression')->nullable();
                $table->json('recipients')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'alert_type']);
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // CLIENTES — Score de satisfação
        // ═══════════════════════════════════════════════════════════════

        if (!Schema::hasColumn('customers', 'satisfaction_score')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->decimal('satisfaction_score', 3, 1)->nullable()->after('status');
                $table->timestamp('last_survey_at')->nullable()->after('satisfaction_score');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_configurations');
        Schema::dropIfExists('system_alerts');
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('quality_audit_items');
        Schema::dropIfExists('quality_audits');
        Schema::dropIfExists('tool_calibrations');
        Schema::dropIfExists('weight_assignments');
        Schema::dropIfExists('payment_receipts');
        Schema::dropIfExists('debt_renegotiation_items');
        Schema::dropIfExists('debt_renegotiations');
        Schema::dropIfExists('whatsapp_configs');
        Schema::dropIfExists('certificate_templates');
        Schema::dropIfExists('excentricity_tests');
        Schema::dropIfExists('calibration_readings');

        if (Schema::hasColumn('equipment_calibrations', 'certificate_template_id')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                $cols = ['certificate_template_id', 'conformity_declaration', 'max_permissible_error', 'max_error_found', 'mass_unit', 'calibration_method'];
                foreach ($cols as $c) { if (Schema::hasColumn('equipment_calibrations', $c)) $table->dropColumn($c); }
            });
        }
        if (Schema::hasColumn('standard_weights', 'assigned_to_vehicle_id')) {
            Schema::table('standard_weights', function (Blueprint $table) {
                foreach (['assigned_to_vehicle_id', 'assigned_to_user_id', 'current_location'] as $c) {
                    if (Schema::hasColumn('standard_weights', $c)) $table->dropColumn($c);
                }
            });
        }
        if (Schema::hasColumn('work_orders', 'checkin_at')) {
            Schema::table('work_orders', function (Blueprint $table) {
                foreach (['checkin_at', 'checkin_lat', 'checkin_lng', 'checkout_at', 'checkout_lat', 'checkout_lng', 'eta_minutes', 'auto_km_calculated'] as $c) {
                    if (Schema::hasColumn('work_orders', $c)) $table->dropColumn($c);
                }
            });
        }
        if (Schema::hasColumn('equipments', 'qr_token')) {
            Schema::table('equipments', function (Blueprint $table) { $table->dropColumn('qr_token'); });
        }
        if (Schema::hasColumn('customers', 'satisfaction_score')) {
            Schema::table('customers', function (Blueprint $table) {
                foreach (['satisfaction_score', 'last_survey_at'] as $c) {
                    if (Schema::hasColumn('customers', $c)) $table->dropColumn($c);
                }
            });
        }
    }
};
