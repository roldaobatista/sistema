<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('technician_cash_transactions', 'tenant_id')) {
            return;
        }

        Schema::table('technician_cash_transactions', function (Blueprint $t) {
            $t->unsignedBigInteger('tenant_id')->nullable();
        });

        // Subquery compatível com SQLite e MySQL
        DB::statement('
            UPDATE technician_cash_transactions
            SET tenant_id = (
                SELECT tcf.tenant_id FROM technician_cash_funds tcf WHERE tcf.id = technician_cash_transactions.fund_id
            )
            WHERE fund_id IS NOT NULL
        ');

        Schema::table('technician_cash_transactions', function (Blueprint $t) {
            $t->unsignedBigInteger('tenant_id')->nullable(false)->change();
            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->index(['tenant_id', 'fund_id']);
        });
    }

    public function down(): void
    {
        Schema::table('technician_cash_transactions', function (Blueprint $t) {
            $t->dropForeign(['tenant_id']);
            $t->dropIndex(['tenant_id', 'fund_id']);
            $t->dropColumn('tenant_id');
        });
    }
};
