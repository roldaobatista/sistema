<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            if (!Schema::hasColumn('expense_categories', 'default_affects_net_value')) {
                $table->boolean('default_affects_net_value')->default(false);
            }
            if (!Schema::hasColumn('expense_categories', 'default_affects_technician_cash')) {
                $table->boolean('default_affects_technician_cash')->default(true);
            }
        });
    }

    public function down(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            $table->dropColumn(['default_affects_net_value', 'default_affects_technician_cash']);
        });
    }
};
