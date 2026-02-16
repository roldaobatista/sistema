<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            $table->boolean('default_affects_net_value')->default(false)->after('budget_limit');
            $table->boolean('default_affects_technician_cash')->default(true)->after('default_affects_net_value');
        });
    }

    public function down(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            $table->dropColumn(['default_affects_net_value', 'default_affects_technician_cash']);
        });
    }
};
