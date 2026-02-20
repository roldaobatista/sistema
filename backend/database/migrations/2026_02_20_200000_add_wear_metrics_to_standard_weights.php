<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('standard_weights')) {
            Schema::table('standard_weights', function (Blueprint $table) {
                if (!Schema::hasColumn('standard_weights', 'wear_rate_percentage')) {
                    $table->decimal('wear_rate_percentage', 5, 2)->nullable();
                }
                if (!Schema::hasColumn('standard_weights', 'expected_failure_date')) {
                    $table->date('expected_failure_date')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('standard_weights')) {
            Schema::table('standard_weights', function (Blueprint $table) {
                if (Schema::hasColumn('standard_weights', 'wear_rate_percentage')) {
                    $table->dropColumn('wear_rate_percentage');
                }
                if (Schema::hasColumn('standard_weights', 'expected_failure_date')) {
                    $table->dropColumn('expected_failure_date');
                }
            });
        }
    }
};
