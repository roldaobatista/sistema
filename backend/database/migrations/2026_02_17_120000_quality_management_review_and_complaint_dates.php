<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_complaints') && !Schema::hasColumn('customer_complaints', 'response_due_at')) {
            Schema::table('customer_complaints', function (Blueprint $table) {
                $table->date('response_due_at')->nullable();
                $table->timestamp('responded_at')->nullable();
            });
        }

        if (!Schema::hasTable('management_reviews')) {
            Schema::create('management_reviews', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->date('meeting_date');
                $table->string('title');
                $table->text('participants')->nullable();
                $table->text('agenda')->nullable();
                $table->text('decisions')->nullable();
                $table->text('summary')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['tenant_id', 'meeting_date']);
            });
        }

        if (!Schema::hasTable('management_review_actions')) {
            Schema::create('management_review_actions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('management_review_id')->constrained()->cascadeOnDelete();
                $table->string('description');
                $table->foreignId('responsible_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('due_date')->nullable();
                $table->string('status', 30)->default('pending');
                $table->date('completed_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['management_review_id', 'status'], 'mgmt_rev_actions_review_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('management_review_actions');
        Schema::dropIfExists('management_reviews');

        if (Schema::hasTable('customer_complaints') && Schema::hasColumn('customer_complaints', 'response_due_at')) {
            Schema::table('customer_complaints', function (Blueprint $table) {
                $table->dropColumn(['response_due_at', 'responded_at']);
            });
        }
    }
};
