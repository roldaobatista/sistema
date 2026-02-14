<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ═══ FROTA — GPS + Pedágio ════════════════════════════════════

        if (!Schema::hasTable('toll_transactions')) {
            Schema::create('toll_transactions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('vehicle_id')->index();
                $t->string('toll_name');
                $t->decimal('amount', 10, 2);
                $t->string('payment_method', 20);
                $t->timestamp('transaction_at');
                $t->string('route')->nullable();
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('vehicle_gps_positions')) {
            Schema::create('vehicle_gps_positions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('vehicle_id')->index();
                $t->decimal('latitude', 10, 7);
                $t->decimal('longitude', 10, 7);
                $t->decimal('speed_kmh', 6, 2)->nullable();
                $t->decimal('heading', 5, 2)->nullable();
                $t->timestamp('recorded_at')->index();
            });
        }

        // ═══ RH — EPI + Gamificação ═══════════════════════════════════

        if (!Schema::hasTable('epi_records')) {
            Schema::create('epi_records', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->string('epi_type', 100);
                $t->string('ca_number', 20)->nullable();
                $t->date('delivered_at');
                $t->date('expiry_date')->nullable();
                $t->integer('quantity')->default(1);
                $t->string('status', 20)->default('active');
                $t->timestamps();
            });
        }

        // ═══ FINANCEIRO — NFS-e + Boleto + Gateway ════════════════════

        if (!Schema::hasTable('nfse_emissions')) {
            Schema::create('nfse_emissions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('work_order_id')->index();
                $t->text('service_description');
                $t->decimal('amount', 12, 2);
                $t->decimal('iss_rate', 5, 2)->default(5.00);
                $t->decimal('iss_amount', 12, 2)->default(0);
                $t->string('status', 20)->default('pending');
                $t->string('protocol_number')->nullable();
                $t->unsignedBigInteger('created_by')->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('payment_gateway_configs')) {
            Schema::create('payment_gateway_configs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->unique();
                $t->string('gateway', 30)->default('none');
                $t->text('api_key')->nullable();
                $t->text('api_secret')->nullable();
                $t->json('methods')->nullable();
                $t->boolean('is_active')->default(false);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('online_payments')) {
            Schema::create('online_payments', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('receivable_id')->index();
                $t->string('method', 20);
                $t->string('status', 20)->default('processing');
                $t->string('gateway_id')->nullable();
                $t->decimal('amount', 12, 2)->nullable();
                $t->timestamp('paid_at')->nullable();
                $t->timestamp('created_at');
            });
        }

        // ═══ MOBILE ════════════════════════════════════════════════════

        if (!Schema::hasTable('sync_queue')) {
            Schema::create('sync_queue', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->string('entity_type', 50);
                $t->unsignedBigInteger('entity_id')->nullable();
                $t->string('action', 10);
                $t->json('payload');
                $t->string('status', 20)->default('pending');
                $t->timestamp('synced_at')->nullable();
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('mobile_notifications')) {
            Schema::create('mobile_notifications', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->index();
                $t->string('title');
                $t->text('body');
                $t->string('type', 30)->nullable();
                $t->string('entity_type', 30)->nullable();
                $t->unsignedBigInteger('entity_id')->nullable();
                $t->string('response_action', 20)->nullable();
                $t->timestamp('responded_at')->nullable();
                $t->boolean('read')->default(false);
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('print_jobs')) {
            Schema::create('print_jobs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->string('document_type', 20);
                $t->unsignedBigInteger('document_id');
                $t->string('printer_type', 20);
                $t->integer('copies')->default(1);
                $t->string('status', 20)->default('queued');
                $t->timestamp('printed_at')->nullable();
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('voice_reports')) {
            Schema::create('voice_reports', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->unsignedBigInteger('work_order_id')->index();
                $t->text('transcription');
                $t->integer('duration_seconds')->nullable();
                $t->string('language', 5)->default('pt_BR');
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('biometric_configs')) {
            Schema::create('biometric_configs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->unique();
                $t->boolean('enabled')->default(false);
                $t->string('type', 20)->nullable();
                $t->string('device_id')->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('photo_annotations')) {
            Schema::create('photo_annotations', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('work_order_id')->index();
                $t->unsignedBigInteger('user_id');
                $t->string('image_path');
                $t->json('annotations');
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('user_preferences')) {
            Schema::create('user_preferences', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->unique();
                $t->boolean('dark_mode')->default(false);
                $t->string('language', 5)->default('pt_BR');
                $t->boolean('notifications')->default(true);
                $t->boolean('data_saver')->default(false);
                $t->boolean('offline_sync')->default(true);
                $t->timestamps();
            });
        }

        // ═══ INOVAÇÃO ═════════════════════════════════════════════════

        if (!Schema::hasTable('custom_themes')) {
            Schema::create('custom_themes', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->unique();
                $t->string('primary_color', 7)->default('#3B82F6');
                $t->string('secondary_color', 7)->default('#10B981');
                $t->string('accent_color', 7)->default('#F59E0B');
                $t->boolean('dark_mode')->default(false);
                $t->string('sidebar_style', 20)->default('default');
                $t->string('font_family', 50)->default('Inter');
                $t->string('logo_url')->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('referral_codes')) {
            Schema::create('referral_codes', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('referrer_id')->index();
                $t->string('code', 10)->unique();
                $t->integer('uses')->default(0);
                $t->string('reward_type', 20)->default('discount');
                $t->decimal('reward_value', 8, 2)->default(10);
                $t->boolean('is_active')->default(true);
                $t->timestamp('created_at');
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'referral_codes', 'custom_themes', 'user_preferences', 'photo_annotations',
            'biometric_configs', 'voice_reports', 'print_jobs', 'mobile_notifications',
            'sync_queue', 'online_payments', 'payment_gateway_configs', 'nfse_emissions',
            'epi_records', 'vehicle_gps_positions', 'toll_transactions',
        ];

        foreach ($tables as $table) {
            Schema::dropIfExists($table);
        }
    }
};
