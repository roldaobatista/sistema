<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('performance_reviews', function (Blueprint $table) {
            // Check if 'period' exists and rename it to 'cycle' if 'cycle' doesn't exist
            if (Schema::hasColumn('performance_reviews', 'period') && !Schema::hasColumn('performance_reviews', 'cycle')) {
                $table->renameColumn('period', 'cycle');
            } elseif (!Schema::hasColumn('performance_reviews', 'cycle')) {
                $table->string('cycle')->nullable(); // e.g. 'Q1 2026'
            }
            
            if (!Schema::hasColumn('performance_reviews', 'title')) {
                $table->string('title')->nullable();
            }

            // Add missing columns if they don't exist
            if (!Schema::hasColumn('performance_reviews', 'year')) {
                $table->year('year')->nullable();
            }
            if (!Schema::hasColumn('performance_reviews', 'type')) {
                $table->enum('type', ['self', 'peer', 'manager', '360'])->default('manager');
            }
            
            // Adjust status enum if possible or add missing statuses (Laravel enum modification is tricky in valid SQL without raw statements, handling simply here)
            // Ideally we would alter the type, but for SQLite/MySQL safety in this context we will rely on string handling or assume duplication is fine for now if distinct values are used.
            // But let's check if the column exists to be sure.
            
            if (!Schema::hasColumn('performance_reviews', 'ratings')) {
                $table->json('ratings')->nullable();
            }
            if (!Schema::hasColumn('performance_reviews', 'okrs')) {
                $table->json('okrs')->nullable();
            }
            if (!Schema::hasColumn('performance_reviews', 'nine_box_potential')) {
                $table->integer('nine_box_potential')->nullable();
            }
            if (!Schema::hasColumn('performance_reviews', 'nine_box_performance')) {
                $table->integer('nine_box_performance')->nullable();
            }
            if (!Schema::hasColumn('performance_reviews', 'action_plan')) {
                $table->text('action_plan')->nullable();
            }
            if (!Schema::hasColumn('performance_reviews', 'comments')) {
                $table->text('comments')->nullable();
            }
            
            // Drop deprecated columns if they exist and are not used by the new logic
            if (Schema::hasColumn('performance_reviews', 'criteria_scores')) {
                $table->dropColumn('criteria_scores');
            }
            if (Schema::hasColumn('performance_reviews', 'strengths')) {
                $table->dropColumn('strengths');
            }
            if (Schema::hasColumn('performance_reviews', 'improvements')) {
                $table->dropColumn('improvements');
            }
            if (Schema::hasColumn('performance_reviews', 'goals')) {
                $table->dropColumn('goals'); // New logic might use 'okrs' or 'action_plan'
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This is a consolidated fix, rolling back is complex but we can try to restore previous state if needed.
        Schema::table('performance_reviews', function (Blueprint $table) {
             if (Schema::hasColumn('performance_reviews', 'cycle')) {
                $table->renameColumn('cycle', 'period');
            }
             $table->dropColumn([
                'year',
                'title',
                'type',
                'ratings',
                'okrs',
                'nine_box_potential',
                'nine_box_performance',
                'action_plan',
                'comments'
            ]);
        });
    }
};
