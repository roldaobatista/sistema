<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            if (!Schema::hasColumn('expense_categories', 'budget_limit')) {
                $table->decimal('budget_limit', 12, 2)->nullable()->after('color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            if (Schema::hasColumn('expense_categories', 'budget_limit')) {
                $table->dropColumn('budget_limit');
            }
        });
    }
};
