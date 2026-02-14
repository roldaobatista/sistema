<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            if (!Schema::hasColumn('trainings', 'is_mandatory')) {
                $table->boolean('is_mandatory')->default(false);
            }
            if (!Schema::hasColumn('trainings', 'skill_area')) {
                $table->string('skill_area')->nullable(); // Helper to link with Skills Matrix later if needed
            }
            if (!Schema::hasColumn('trainings', 'level')) {
                $table->enum('level', ['basic', 'intermediate', 'advanced'])->default('basic');
            }
            if (!Schema::hasColumn('trainings', 'cost')) {
                $table->decimal('cost', 10, 2)->nullable();
            }
            if (!Schema::hasColumn('trainings', 'instructor')) {
                $table->string('instructor')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('trainings', function (Blueprint $table) {
            $table->dropColumn(['is_mandatory', 'skill_area', 'level', 'cost', 'instructor']);
        });
    }
};
