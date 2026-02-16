<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BUG-01: Adiciona source_filter à commission_rules (filtro de origem comercial)
 * BUG-02: Adiciona settlement_id à commission_events (FK para fechamento)
 */
return new class extends Migration
{
    public function up(): void
    {
        // BUG-01: source_filter — usado em CommissionService::calculateAndGenerate()
        // para filtrar regras por origem do orçamento (prospecção, retorno, etc.)
        Schema::table('commission_rules', function (Blueprint $table) {
            if (!Schema::hasColumn('commission_rules', 'source_filter')) {
                $table->string('source_filter', 50)->nullable();
            }
        });

        // BUG-02: settlement_id — FK para vincular eventos ao fechamento mensal
        Schema::table('commission_events', function (Blueprint $table) {
            if (!Schema::hasColumn('commission_events', 'settlement_id')) {
                $table->unsignedBigInteger('settlement_id')->nullable();
                $table->foreign('settlement_id')->references('id')->on('commission_settlements')->nullOnDelete();
                $table->index(['settlement_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('commission_events', function (Blueprint $table) {
            if (Schema::hasColumn('commission_events', 'settlement_id')) {
                $table->dropForeign(['settlement_id']);
                $table->dropColumn('settlement_id');
            }
        });

        Schema::table('commission_rules', function (Blueprint $table) {
            if (Schema::hasColumn('commission_rules', 'source_filter')) {
                $table->dropColumn('source_filter');
            }
        });
    }
};
