<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adiciona colunas faltantes em commission_settlements:
 * closed_by, closed_at, approved_by, approved_at, rejection_reason
 * Usadas pelos controllers approveSettlement, rejectSettlement, reopenSettlement, closeSettlement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_settlements', function (Blueprint $table) {
            if (!Schema::hasColumn('commission_settlements', 'closed_by')) {
                $table->unsignedBigInteger('closed_by')->nullable();
            }
            if (!Schema::hasColumn('commission_settlements', 'closed_at')) {
                $table->timestamp('closed_at')->nullable();
            }
            if (!Schema::hasColumn('commission_settlements', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable();
            }
            if (!Schema::hasColumn('commission_settlements', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }
            if (!Schema::hasColumn('commission_settlements', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('commission_settlements', function (Blueprint $table) {
            $cols = ['closed_by', 'closed_at', 'approved_by', 'approved_at', 'rejection_reason'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('commission_settlements', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
