<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fueling_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('fueling_logs', 'rejection_reason')) {
                $table->string('rejection_reason', 500)->nullable();
            }
            if (!Schema::hasColumn('fueling_logs', 'affects_technician_cash')) {
                $table->boolean('affects_technician_cash')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::table('fueling_logs', function (Blueprint $table) {
            if (Schema::hasColumn('fueling_logs', 'rejection_reason')) {
                $table->dropColumn('rejection_reason');
            }
            if (Schema::hasColumn('fueling_logs', 'affects_technician_cash')) {
                $table->dropColumn('affects_technician_cash');
            }
        });
    }
};
