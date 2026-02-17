<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fix missing columns identified by test suite execution.
 * Adds columns that are referenced by Models/Tests but were missing from schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        // work_orders.business_number — referenced in WorkOrder model fillable
        if (!Schema::hasColumn('work_orders', 'business_number')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->string('business_number', 50)->nullable();
                $table->index(['tenant_id', 'business_number']);
            });
        }

        // commission_goals.bonus_rules — lost when table was recreated in resolve_system_gaps_batch1
        if (!Schema::hasColumn('commission_goals', 'bonus_rules')) {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->json('bonus_rules')->nullable();
            });
        }

        // commission_goals.type — also lost in recreation (was in original advanced migration)
        if (!Schema::hasColumn('commission_goals', 'type')) {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->string('type', 30)->default('revenue');
            });
        }

        // commission_goals.status — also lost in recreation
        if (!Schema::hasColumn('commission_goals', 'status')) {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->string('status', 20)->default('active');
            });
        }

        // quotes.title — referenced in tests for quote creation
        if (!Schema::hasColumn('quotes', 'title')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->string('title', 200)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quotes', 'title')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->dropColumn('title');
            });
        }

        if (Schema::hasColumn('commission_goals', 'status')) {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }

        if (Schema::hasColumn('commission_goals', 'type')) {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->dropColumn('type');
            });
        }

        if (Schema::hasColumn('commission_goals', 'bonus_rules')) {
            Schema::table('commission_goals', function (Blueprint $table) {
                $table->dropColumn('bonus_rules');
            });
        }

        if (Schema::hasColumn('work_orders', 'business_number')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->dropIndex(['tenant_id', 'business_number']);
                $table->dropColumn('business_number');
            });
        }
    }
};
