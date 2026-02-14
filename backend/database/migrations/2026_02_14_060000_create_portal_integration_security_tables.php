<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ═══ PORTAL DO CLIENTE ════════════════════════════════════════

        if (!Schema::hasTable('support_tickets')) {
            Schema::create('support_tickets', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('customer_id')->nullable()->index();
                $t->string('source', 30)->default('manual');
                $t->text('qr_data')->nullable();
                $t->text('description');
                $t->string('priority', 20)->default('medium');
                $t->string('status', 30)->default('open');
                $t->unsignedBigInteger('assigned_to')->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('chat_messages')) {
            Schema::create('chat_messages', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('ticket_id')->index();
                $t->unsignedBigInteger('sender_id');
                $t->string('sender_type', 20);
                $t->text('message');
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('scheduled_appointments')) {
            Schema::create('scheduled_appointments', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('customer_id')->index();
                $t->timestamp('scheduled_at');
                $t->string('service_type', 100);
                $t->text('notes')->nullable();
                $t->string('status', 30)->default('confirmed');
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('push_subscriptions')) {
            Schema::create('push_subscriptions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->text('endpoint');
                $t->string('p256dh_key', 255);
                $t->string('auth_key', 255);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('knowledge_base_articles')) {
            Schema::create('knowledge_base_articles', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('title');
                $t->text('content');
                $t->string('category', 100)->index();
                $t->boolean('published')->default(false);
                $t->integer('sort_order')->default(0);
                $t->unsignedBigInteger('created_by')->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('customer_locations')) {
            Schema::create('customer_locations', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('customer_id')->index();
                $t->string('name');
                $t->string('address', 500);
                $t->string('city', 100);
                $t->string('state', 2);
                $t->string('zip_code', 10)->nullable();
                $t->decimal('latitude', 10, 7)->nullable();
                $t->decimal('longitude', 10, 7)->nullable();
                $t->string('contact_name')->nullable();
                $t->string('contact_phone', 20)->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('portal_white_label')) {
            Schema::create('portal_white_label', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->unique();
                $t->string('company_name')->nullable();
                $t->string('logo_url')->nullable();
                $t->string('primary_color', 7)->default('#3B82F6');
                $t->string('secondary_color', 7)->default('#10B981');
                $t->text('custom_css')->nullable();
                $t->string('custom_domain')->nullable();
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('nps_surveys')) {
            Schema::create('nps_surveys', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('customer_id')->index();
                $t->unsignedBigInteger('work_order_id')->nullable();
                $t->tinyInteger('score');
                $t->string('category', 20);
                $t->text('comment')->nullable();
                $t->timestamp('created_at');
            });
        }

        // ═══ INTEGRAÇÕES ══════════════════════════════════════════════

        if (!Schema::hasTable('webhooks')) {
            Schema::create('webhooks', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('url', 500);
                $t->string('event', 50)->index();
                $t->string('secret', 64);
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('erp_sync_logs')) {
            Schema::create('erp_sync_logs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('provider', 30);
                $t->json('modules');
                $t->string('status', 20)->default('queued');
                $t->text('error_log')->nullable();
                $t->integer('records_synced')->default(0);
                $t->timestamp('synced_at');
                $t->unsignedBigInteger('created_by')->nullable();
            });
        }

        if (!Schema::hasTable('marketplace_partners')) {
            Schema::create('marketplace_partners', function (Blueprint $t) {
                $t->id();
                $t->string('name');
                $t->string('category', 50);
                $t->text('description')->nullable();
                $t->string('logo_url')->nullable();
                $t->string('website_url')->nullable();
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('marketplace_requests')) {
            Schema::create('marketplace_requests', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('partner_id');
                $t->text('notes')->nullable();
                $t->string('status', 20)->default('pending');
                $t->unsignedBigInteger('created_by')->nullable();
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('sso_configurations')) {
            Schema::create('sso_configurations', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('provider', 20);
                $t->text('client_id');
                $t->text('client_secret');
                $t->string('tenant_domain')->nullable();
                $t->boolean('is_active')->default(true);
                $t->timestamps();
                $t->unique(['tenant_id', 'provider']);
            });
        }

        if (!Schema::hasTable('notification_channels')) {
            Schema::create('notification_channels', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('type', 20);
                $t->string('webhook_url', 500);
                $t->string('channel_name', 100)->nullable();
                $t->json('events');
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('marketing_integrations')) {
            Schema::create('marketing_integrations', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->unique();
                $t->string('provider', 30);
                $t->text('api_key');
                $t->boolean('sync_contacts')->default(true);
                $t->boolean('sync_events')->default(false);
                $t->timestamps();
            });
        }

        // ═══ SEGURANÇA ════════════════════════════════════════════════

        if (!Schema::hasTable('user_2fa')) {
            Schema::create('user_2fa', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->unique();
                $t->text('secret');
                $t->boolean('is_enabled')->default(false);
                $t->timestamp('verified_at')->nullable();
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('user_sessions')) {
            Schema::create('user_sessions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('user_id')->index();
                $t->string('token_id')->nullable();
                $t->ipAddress('ip_address')->nullable();
                $t->text('user_agent')->nullable();
                $t->timestamp('last_activity');
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('data_masking_rules')) {
            Schema::create('data_masking_rules', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('table_name', 100);
                $t->string('column_name', 100);
                $t->string('masking_type', 20);
                $t->json('roles_exempt')->nullable();
                $t->boolean('is_active')->default(true);
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('immutable_backups')) {
            Schema::create('immutable_backups', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('type', 20);
                $t->string('status', 20)->default('queued');
                $t->integer('retention_days')->default(30);
                $t->string('file_path')->nullable();
                $t->bigInteger('size_bytes')->nullable();
                $t->unsignedBigInteger('requested_by')->nullable();
                $t->timestamp('completed_at')->nullable();
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('password_policies')) {
            Schema::create('password_policies', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->unique();
                $t->integer('min_length')->default(8);
                $t->boolean('require_uppercase')->default(true);
                $t->boolean('require_lowercase')->default(true);
                $t->boolean('require_number')->default(true);
                $t->boolean('require_special')->default(false);
                $t->integer('expiry_days')->default(90);
                $t->integer('max_attempts')->default(5);
                $t->integer('lockout_minutes')->default(15);
                $t->integer('history_count')->default(3);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('geo_login_alerts')) {
            Schema::create('geo_login_alerts', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->ipAddress('ip_address');
                $t->string('city')->nullable();
                $t->string('country', 2)->nullable();
                $t->decimal('latitude', 10, 7)->nullable();
                $t->decimal('longitude', 10, 7)->nullable();
                $t->boolean('is_suspicious')->default(false);
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('privacy_consents')) {
            Schema::create('privacy_consents', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->unsignedBigInteger('user_id')->index();
                $t->string('consent_type', 30);
                $t->boolean('granted');
                $t->ipAddress('ip_address')->nullable();
                $t->text('user_agent')->nullable();
                $t->timestamp('consented_at');
            });
        }

        if (!Schema::hasTable('watermark_configs')) {
            Schema::create('watermark_configs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->unique();
                $t->boolean('enabled')->default(false);
                $t->string('text', 100)->default('CONFIDENCIAL');
                $t->integer('opacity')->default(30);
                $t->string('position', 20)->default('diagonal');
                $t->boolean('include_user_info')->default(false);
                $t->boolean('include_timestamp')->default(true);
                $t->timestamps();
            });
        }

        if (!Schema::hasTable('access_time_restrictions')) {
            Schema::create('access_time_restrictions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('role_name', 50);
                $t->json('allowed_days');
                $t->time('start_time');
                $t->time('end_time');
                $t->boolean('is_active')->default(true);
                $t->timestamp('created_at');
            });
        }

        if (!Schema::hasTable('vulnerability_scans')) {
            Schema::create('vulnerability_scans', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id')->index();
                $t->string('scan_type', 20)->default('full');
                $t->string('status', 20)->default('running');
                $t->json('findings')->nullable();
                $t->integer('critical_count')->default(0);
                $t->integer('warning_count')->default(0);
                $t->unsignedBigInteger('requested_by')->nullable();
                $t->timestamp('scanned_at');
                $t->timestamp('completed_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'vulnerability_scans', 'access_time_restrictions', 'watermark_configs',
            'privacy_consents', 'geo_login_alerts', 'password_policies',
            'immutable_backups', 'data_masking_rules', 'user_sessions', 'user_2fa',
            'marketing_integrations', 'notification_channels', 'sso_configurations',
            'marketplace_requests', 'marketplace_partners', 'erp_sync_logs', 'webhooks',
            'nps_surveys', 'portal_white_label', 'customer_locations',
            'knowledge_base_articles', 'push_subscriptions', 'scheduled_appointments',
            'chat_messages', 'support_tickets',
        ];

        foreach ($tables as $table) {
            Schema::dropIfExists($table);
        }
    }
};
