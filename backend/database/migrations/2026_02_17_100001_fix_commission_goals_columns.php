<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adiciona colunas faltantes em commission_goals:
 * type, bonus_percentage, bonus_amount, notes
 * Usadas pelo CommissionGoal model e CommissionGoalController.
 * Também ajusta o unique index para incluir 'type'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_goals', function (Blueprint $table) {
            if (!Schema::hasColumn('commission_goals', 'type')) {
                $table->string('type', 30)->default('revenue')->after('period');
            }
            if (!Schema::hasColumn('commission_goals', 'bonus_percentage')) {
                $table->decimal('bonus_percentage', 5, 2)->nullable()->after('achieved_amount');
            }
            if (!Schema::hasColumn('commission_goals', 'bonus_amount')) {
                $table->decimal('bonus_amount', 12, 2)->nullable()->after('bonus_percentage');
            }
            if (!Schema::hasColumn('commission_goals', 'notes')) {
                $table->text('notes')->nullable()->after('bonus_amount');
            }
        });

        // Ajustar unique index: remover antigo [tenant_id, user_id, period]
        // e criar novo [tenant_id, user_id, period, type]
        try {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->dropUnique(['tenant_id', 'user_id', 'period']);
            });
        } catch (\Exception $e) {
            // Index pode já não existir — segue
        }

        Schema::table('commission_goals', function (Blueprint $table) {
            $table->unique(['tenant_id', 'user_id', 'period', 'type'], 'commission_goals_tenant_user_period_type_unique');
        });
    }

    public function down(): void
    {
        try {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->dropUnique('commission_goals_tenant_user_period_type_unique');
            });
        } catch (\Exception $e) {
            // segue
        }

        Schema::table('commission_goals', function (Blueprint $table) {
            $cols = ['type', 'bonus_percentage', 'bonus_amount', 'notes'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('commission_goals', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        // Restaurar unique original
        try {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->unique(['tenant_id', 'user_id', 'period']);
            });
        } catch (\Exception $e) {
            // segue
        }
    }
};
