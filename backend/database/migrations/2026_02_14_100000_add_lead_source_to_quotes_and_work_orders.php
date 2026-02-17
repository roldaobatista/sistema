<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // P2.1: Campo "Origem Comercial" — afeta comissão do vendedor
        // Valores: prospeccao, retorno, contato_direto, indicacao
        if (Schema::hasTable('quotes') && !Schema::hasColumn('quotes', 'source')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->string('source', 30)->nullable();
            });
        }

        if (Schema::hasTable('work_orders') && !Schema::hasColumn('work_orders', 'lead_source')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->string('lead_source', 30)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quotes', 'source')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->dropColumn('source');
            });
        }

        if (Schema::hasColumn('work_orders', 'lead_source')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->dropColumn('lead_source');
            });
        }
    }
};
