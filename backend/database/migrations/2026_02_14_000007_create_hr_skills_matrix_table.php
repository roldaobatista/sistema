<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('skills')) {
            Schema::create('skills', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->string('name');
                $table->string('category')->nullable(); // 'Technical', 'Soft Skill', 'Language', etc.
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('skill_requirements')) {
            Schema::create('skill_requirements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('position_id')->constrained()->onDelete('cascade');
                $table->foreignId('skill_id')->constrained()->onDelete('cascade');
                $table->integer('required_level')->default(1); // 1-5 scale
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('user_skills')) {
            Schema::create('user_skills', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('skill_id')->constrained()->onDelete('cascade');
                $table->integer('current_level')->default(1); // 1-5 scale
                $table->date('assessed_at')->nullable();
                $table->foreignId('assessed_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_skills');
        Schema::dropIfExists('skill_requirements');
        Schema::dropIfExists('skills');
    }
};
