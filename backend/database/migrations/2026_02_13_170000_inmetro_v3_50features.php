<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Extend inmetro_owners with scoring, segmentation, CRM tracking ──
        Schema::table('inmetro_owners', function (Blueprint $table) {
            $table->unsignedTinyInteger('lead_score')->default(0)->after('priority');
            $table->string('segment', 50)->nullable()->after('lead_score');
            $table->string('cnpj_root', 8)->nullable()->after('segment');
            $table->timestamp('last_contacted_at')->nullable()->after('cnpj_root');
            $table->unsignedInteger('contact_count')->default(0)->after('last_contacted_at');
            $table->timestamp('next_contact_at')->nullable()->after('contact_count');
            $table->boolean('churn_risk')->default(false)->after('next_contact_at');
            $table->index('lead_score');
            $table->index('segment');
            $table->index('cnpj_root');
            $table->index('churn_risk');
        });

        // ── Extend inmetro_instruments with equipment link ──
        Schema::table('inmetro_instruments', function (Blueprint $table) {
            $table->unsignedBigInteger('linked_equipment_id')->nullable()->after('source');
            $table->index('linked_equipment_id');
        });

        // ── Lead Interactions (CRM-like contact log) ──
        Schema::create('inmetro_lead_interactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('inmetro_owners')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->string('channel', 30); // whatsapp, phone, email, visit, system
            $table->string('result', 30); // interested, rejected, no_answer, scheduled, converted
            $table->text('notes')->nullable();
            $table->timestamp('next_follow_up_at')->nullable();
            $table->timestamps();
            $table->index(['owner_id', 'created_at']);
            $table->index(['tenant_id', 'created_at']);
        });

        // ── Lead Scores (computed with factors breakdown) ──
        Schema::create('inmetro_lead_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('inmetro_owners')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->unsignedTinyInteger('total_score')->default(0);
            $table->unsignedTinyInteger('expiration_score')->default(0);
            $table->unsignedTinyInteger('value_score')->default(0);
            $table->unsignedTinyInteger('contact_score')->default(0);
            $table->unsignedTinyInteger('region_score')->default(0);
            $table->unsignedTinyInteger('instrument_score')->default(0);
            $table->json('factors')->nullable();
            $table->timestamp('calculated_at');
            $table->timestamps();
            $table->unique('owner_id');
            $table->index(['tenant_id', 'total_score']);
        });

        // ── Competitor Market Share Snapshots ──
        Schema::create('inmetro_competitor_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('competitor_id')->nullable()->constrained('inmetro_competitors')->onUpdate('cascade')->onDelete('cascade');
            $table->string('snapshot_type', 20)->default('monthly'); // monthly, quarterly
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedInteger('instrument_count')->default(0);
            $table->unsignedInteger('repair_count')->default(0);
            $table->unsignedInteger('new_instruments')->default(0);
            $table->unsignedInteger('lost_instruments')->default(0);
            $table->decimal('market_share_pct', 5, 2)->default(0);
            $table->json('by_city')->nullable();
            $table->json('by_type')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'period_start']);
            $table->index(['competitor_id', 'period_start']);
        });

        // ── Prospection Queue (daily auto-generated) ──
        Schema::create('inmetro_prospection_queue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('inmetro_owners')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');
            $table->date('queue_date');
            $table->unsignedTinyInteger('position')->default(0);
            $table->string('reason', 100); // expiring_soon, rejected, high_value, new_registration, churn_risk
            $table->text('suggested_script')->nullable();
            $table->string('status', 20)->default('pending'); // pending, contacted, skipped, converted
            $table->timestamp('contacted_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'queue_date', 'position']);
            $table->index(['assigned_to', 'queue_date']);
        });

        // ── Compliance Checklists (regulatory per instrument type) ──
        Schema::create('inmetro_compliance_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->string('instrument_type', 100);
            $table->string('regulation_reference', 100)->nullable(); // RTAC number
            $table->string('title');
            $table->json('items'); // [{item, required, description}]
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['tenant_id', 'instrument_type']);
        });

        // ── Webhook Subscriptions ──
        Schema::create('inmetro_webhooks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->string('event_type', 50); // new_lead, lead_expiring, instrument_rejected, competitor_change
            $table->string('url', 500);
            $table->string('secret', 100)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('failure_count')->default(0);
            $table->timestamp('last_triggered_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'event_type']);
        });

        // ── Win/Loss tracking on quotes ──
        Schema::create('inmetro_win_loss', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('owner_id')->nullable()->constrained('inmetro_owners')->onUpdate('cascade')->onDelete('set null');
            $table->foreignId('competitor_id')->nullable()->constrained('inmetro_competitors')->onUpdate('cascade')->onDelete('set null');
            $table->string('outcome', 10); // win, loss
            $table->string('reason', 100)->nullable(); // price, relationship, speed, quality
            $table->decimal('estimated_value', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->date('outcome_date');
            $table->timestamps();
            $table->index(['tenant_id', 'outcome_date']);
            $table->index(['competitor_id', 'outcome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inmetro_win_loss');
        Schema::dropIfExists('inmetro_webhooks');
        Schema::dropIfExists('inmetro_compliance_checklists');
        Schema::dropIfExists('inmetro_prospection_queue');
        Schema::dropIfExists('inmetro_competitor_snapshots');
        Schema::dropIfExists('inmetro_lead_scores');
        Schema::dropIfExists('inmetro_lead_interactions');

        Schema::table('inmetro_instruments', function (Blueprint $table) {
            $table->dropColumn('linked_equipment_id');
        });

        Schema::table('inmetro_owners', function (Blueprint $table) {
            $table->dropColumn([
                'lead_score', 'segment', 'cnpj_root',
                'last_contacted_at', 'contact_count',
                'next_contact_at', 'churn_risk',
            ]);
        });
    }
};
