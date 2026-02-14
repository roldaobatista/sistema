<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->boolean('affects_net_value')->default(true)
                ->after('affects_technician_cash')
                ->comment('Se true, esta despesa é descontada do valor líquido da OS para cálculo de comissão');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('affects_net_value');
        });
    }
};
