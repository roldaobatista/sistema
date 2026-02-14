<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('performance_reviews')) {
            Schema::create('performance_reviews', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('user_id')->constrained()->onDelete('cascade'); // Reviewee
                $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade'); // Reviewer
                $table->string('cycle')->nullable(); // e.g. 'Q1 2026'
                $table->year('year');
                $table->enum('type', ['self', 'peer', 'manager', '360'])->default('manager');
                $table->enum('status', ['draft', 'submitted', 'finalized', 'acknowledged'])->default('draft');
                $table->json('ratings')->nullable(); // Structured Q&A
                $table->json('okrs')->nullable(); // OKR progress snapshot
                $table->integer('nine_box_potential')->nullable(); // 1-3
                $table->integer('nine_box_performance')->nullable(); // 1-3
                $table->text('action_plan')->nullable();
                $table->text('comments')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('continuous_feedback')) {
            Schema::create('continuous_feedback', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
                $table->foreignId('from_user_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('to_user_id')->constrained('users')->onDelete('cascade');
                $table->enum('type', ['praise', 'suggestion', 'concern'])->default('praise');
                $table->text('content');
                $table->boolean('is_anonymous')->default(false);
                $table->enum('visibility', ['private', 'manager_only', 'public'])->default('private');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('continuous_feedback');
        Schema::dropIfExists('performance_reviews');
    }
};
