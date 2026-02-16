<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('system_alerts') && !Schema::hasColumn('system_alerts', 'escalated_at')) {
            Schema::table('system_alerts', function (Blueprint $table) {
                $table->timestamp('escalated_at')->nullable();
            });
        }

        if (!Schema::hasTable('alert_configurations')) {
            return;
        }

        Schema::table('alert_configurations', function (Blueprint $table) {
            if (!Schema::hasColumn('alert_configurations', 'escalation_hours')) {
                $table->unsignedTinyInteger('escalation_hours')->nullable();
            }
            if (!Schema::hasColumn('alert_configurations', 'escalation_recipients')) {
                $table->json('escalation_recipients')->nullable();
            }
            if (!Schema::hasColumn('alert_configurations', 'blackout_start')) {
                $table->string('blackout_start', 5)->nullable();
            }
            if (!Schema::hasColumn('alert_configurations', 'blackout_end')) {
                $table->string('blackout_end', 5)->nullable();
            }
            if (!Schema::hasColumn('alert_configurations', 'threshold_amount')) {
                $table->decimal('threshold_amount', 12, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('system_alerts') && Schema::hasColumn('system_alerts', 'escalated_at')) {
            Schema::table('system_alerts', function (Blueprint $table) {
                $table->dropColumn('escalated_at');
            });
        }

        if (!Schema::hasTable('alert_configurations')) {
            return;
        }
        Schema::table('alert_configurations', function (Blueprint $table) {
            if (Schema::hasColumn('alert_configurations', 'escalation_hours')) {
                $table->dropColumn('escalation_hours');
            }
            if (Schema::hasColumn('alert_configurations', 'escalation_recipients')) {
                $table->dropColumn('escalation_recipients');
            }
            if (Schema::hasColumn('alert_configurations', 'blackout_start')) {
                $table->dropColumn('blackout_start');
            }
            if (Schema::hasColumn('alert_configurations', 'blackout_end')) {
                $table->dropColumn('blackout_end');
            }
            if (Schema::hasColumn('alert_configurations', 'threshold_amount')) {
                $table->dropColumn('threshold_amount');
            }
        });
    }
};
