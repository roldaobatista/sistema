<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // #8B Auto-Assignment Rules
        Schema::create('auto_assignment_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('entity_type')->default('work_order'); // work_order, service_call
            $table->string('strategy')->default('round_robin'); // round_robin, least_loaded, skill_match, proximity
            $table->json('conditions')->nullable(); // { os_types: [], priorities: [], regions: [] }
            $table->json('technician_ids')->nullable(); // specific techs or empty = all
            $table->json('required_skills')->nullable();
            $table->integer('priority')->default(10);
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'entity_type', 'is_active']);
        });

        // #1 SLA fields on work_orders (if not present)
        if (!Schema::hasColumn('work_orders', 'sla_deadline')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->timestamp('sla_deadline')->nullable()->after('prioridade');
                $table->integer('sla_hours')->nullable()->after('sla_deadline');
            });
        }

        // #2B/8B Auto-assign tracking on work_orders
        if (!Schema::hasColumn('work_orders', 'auto_assigned')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->boolean('auto_assigned')->default(false)->after('assigned_to');
                $table->foreignId('auto_assignment_rule_id')->nullable()->after('auto_assigned')
                    ->constrained('auto_assignment_rules')->nullOnDelete();
            });
        }

        // #4 Photo checklist JSON on work_orders
        if (!Schema::hasColumn('work_orders', 'photo_checklist')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->json('photo_checklist')->nullable()->after('checklist');
            });
        }

        // #7 Reopen counter for first-fix-rate
        if (!Schema::hasColumn('work_orders', 'reopen_count')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->integer('reopen_count')->default(0)->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('auto_assignment_rules');

        Schema::table('work_orders', function (Blueprint $table) {
            $columns = ['sla_deadline', 'sla_hours', 'auto_assigned', 'auto_assignment_rule_id', 'photo_checklist', 'reopen_count'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('work_orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
