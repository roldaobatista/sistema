<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Commission Splits — divide comissão entre múltiplos beneficiários
        Schema::create('commission_splits', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('commission_event_id');
            $t->unsignedBigInteger('user_id');
            $t->decimal('percentage', 5, 2);
            $t->decimal('amount', 12, 2);
            $t->string('role', 20)->default('technician');
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('commission_event_id')->references('id')->on('commission_events')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->index(['commission_event_id']);
        });

        // Commission Disputes — contestações de comissão
        Schema::create('commission_disputes', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('commission_event_id');
            $t->unsignedBigInteger('user_id'); // quem contestou
            $t->text('reason');
            $t->string('status', 20)->default('open'); // open, accepted, rejected
            $t->text('resolution_notes')->nullable();
            $t->unsignedBigInteger('resolved_by')->nullable();
            $t->timestamp('resolved_at')->nullable();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('commission_event_id')->references('id')->on('commission_events')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->index(['tenant_id', 'status']);
        });

        // Commission Goals — metas de vendas
        Schema::create('commission_goals', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('user_id');
            $t->string('period', 7); // 2026-02
            $t->decimal('target_amount', 12, 2);
            $t->json('bonus_rules')->nullable(); // [{"threshold_pct": 100, "bonus_pct": 0.5}]
            $t->decimal('achieved_amount', 12, 2)->default(0);
            $t->string('status', 20)->default('active'); // active, closed
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->unique(['tenant_id', 'user_id', 'period']);
        });

        // Commission Campaigns — aceleradores / campanhas temporárias
        Schema::create('commission_campaigns', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->decimal('multiplier', 4, 2)->default(1.00); // 1.50 = 150%
            $t->string('applies_to_role', 20)->nullable(); // null = todos
            $t->string('applies_to_calculation_type', 50)->nullable();
            $t->date('starts_at');
            $t->date('ends_at');
            $t->boolean('active')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });

        // Recurring Commissions — comissão recorrente de contratos
        Schema::create('recurring_commissions', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('user_id');
            $t->unsignedBigInteger('recurring_contract_id');
            $t->unsignedBigInteger('commission_rule_id');
            $t->string('status', 20)->default('active'); // active, paused, terminated
            $t->date('last_generated_at')->nullable();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->foreign('commission_rule_id')->references('id')->on('commission_rules')->cascadeOnDelete();
            $t->foreign('recurring_contract_id')->references('id')->on('recurring_contracts')->cascadeOnDelete();
            $t->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_commissions');
        Schema::dropIfExists('commission_campaigns');
        Schema::dropIfExists('commission_goals');
        Schema::dropIfExists('commission_disputes');
        Schema::dropIfExists('commission_splits');
    }
};
