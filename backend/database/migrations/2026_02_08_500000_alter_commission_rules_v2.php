<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_rules', function (Blueprint $t) {
            // Substitui type (percentage/fixed) por calculation_type (10+ opções)
            $t->string('calculation_type', 40)->default('percent_gross');
            // Para quem: técnico, vendedor, motorista
            $t->string('applies_to_role', 20)->default('technician');
            // Quando disparar: os_concluida, parcela_paga, os_faturada
            $t->string('applies_when', 20)->default('os_completed');
            // Dados extras (faixas escalonadas, fórmulas custom)
            $t->json('tiers')->nullable();
            // Prioridade de aplicação
            $t->integer('priority')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('commission_rules', function (Blueprint $t) {
            $t->dropColumn(['calculation_type', 'applies_to_role', 'applies_when', 'tiers', 'priority']);
        });
    }
};
