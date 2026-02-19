<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Templates de chamados recorrentes
        Schema::create('service_call_templates', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('name');
            $t->string('priority', 10)->default('normal');
            $t->text('observations')->nullable();
            $t->json('equipment_ids')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->index(['tenant_id', 'is_active']);
        });

        // Melhorias na tabela service_calls
        Schema::table('service_calls', function (Blueprint $t) {
            if (!Schema::hasColumn('service_calls', 'contract_id')) {
                $t->unsignedBigInteger('contract_id')->nullable();
                $t->foreign('contract_id')->references('id')->on('contracts')->nullOnDelete();
            }
            if (!Schema::hasColumn('service_calls', 'sla_policy_id')) {
                $t->unsignedBigInteger('sla_policy_id')->nullable();
                $t->foreign('sla_policy_id')->references('id')->on('sla_policies')->nullOnDelete();
            }
            if (!Schema::hasColumn('service_calls', 'reschedule_history')) {
                $t->json('reschedule_history')->nullable();
            }
            if (!Schema::hasColumn('service_calls', 'template_id')) {
                $t->unsignedBigInteger('template_id')->nullable();
                $t->foreign('template_id')->references('id')->on('service_call_templates')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_call_templates');

        Schema::table('service_calls', function (Blueprint $t) {
            // MySQL exige drop das FKs antes de dropar as colunas
            foreach (['contract_id', 'sla_policy_id', 'template_id'] as $fkCol) {
                if (Schema::hasColumn('service_calls', $fkCol)) {
                    try {
                        $t->dropForeign(['service_calls', $fkCol]);
                    } catch (\Throwable $e) {
                        // Ignora se FK já foi removida
                    }
                }
            }
            $columns = ['contract_id', 'sla_policy_id', 'reschedule_history', 'template_id'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('service_calls', $col)) {
                    $t->dropColumn($col);
                }
            }
        });
    }
};
