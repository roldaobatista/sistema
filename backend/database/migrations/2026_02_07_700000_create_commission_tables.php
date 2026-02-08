<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Regras de comissão (ex: técnico X ganha 10% sobre serviços)
        Schema::create('commission_rules', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('user_id'); // técnico/vendedor
            $t->string('name');
            $t->string('type', 20)->default('percentage'); // percentage, fixed
            $t->decimal('value', 8, 2); // 10.00 = 10%  ou  R$ 10,00
            $t->string('applies_to', 20)->default('all'); // all, products, services
            $t->boolean('active')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->index(['tenant_id', 'user_id']);
        });

        // Eventos de comissão (gerados ao fechar OS)
        Schema::create('commission_events', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->foreignId('commission_rule_id')->constrained()->cascadeOnDelete();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('user_id');
            $t->decimal('base_amount', 12, 2); // valor base (total OS ou item)
            $t->decimal('commission_amount', 12, 2); // valor da comissão
            $t->string('status', 20)->default('pending'); // pending, approved, paid, reversed
            $t->text('notes')->nullable();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->index(['tenant_id', 'user_id', 'status']);
        });

        // Fechamento mensal de comissões
        Schema::create('commission_settlements', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('user_id');
            $t->string('period', 7); // 2026-02
            $t->decimal('total_amount', 12, 2);
            $t->integer('events_count');
            $t->string('status', 20)->default('open'); // open, closed, paid
            $t->date('paid_at')->nullable();
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->unique(['tenant_id', 'user_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_settlements');
        Schema::dropIfExists('commission_events');
        Schema::dropIfExists('commission_rules');
    }
};
