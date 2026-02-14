<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Templates (Canned Responses)
        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // Null = Shared/System
            $table->string('name');
            $table->string('subject')->nullable();
            $table->text('body');
            $table->boolean('is_shared')->default(false);
            $table->timestamps();
        });

        // 2. Signatures
        Schema::create('email_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_account_id')->nullable()->constrained()->nullOnDelete(); // Null = Default for user
            $table->string('name');
            $table->text('html_content');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        // 3. Internal Notes (Collaboration)
        Schema::create('email_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->timestamps();
        });

        // 4. Assignments & Tracking (Colunas na tabela emails)
        Schema::table('emails', function (Blueprint $table) {
            $table->timestamp('scheduled_at')->nullable()->after('date');
            $table->timestamp('sent_at')->nullable()->after('scheduled_at');
            $table->string('tracking_id')->nullable()->index()->after('message_id');
            $table->integer('read_count')->default(0);
            $table->timestamp('last_read_at')->nullable();
            $table->timestamp('snoozed_until')->nullable();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
        });

        // 5. Shared Tags
        Schema::create('email_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->default('#EF4444'); // Tailwind colors
            $table->timestamps();
        });

        // Pivot table email_tag
        Schema::create('email_email_tag', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_tag_id')->constrained()->cascadeOnDelete();
        });

        // 6. Activity Log (Timeline)
        Schema::create('email_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // 'read', 'replied', 'archived', 'note_added', 'assigned', 'tag_added'
            $table->text('details')->nullable(); // JSON details
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_activities');
        Schema::dropIfExists('email_email_tag');
        Schema::dropIfExists('email_tags');
        Schema::dropIfExists('email_notes');
        Schema::dropIfExists('email_signatures');
        Schema::dropIfExists('email_templates');

        Schema::table('emails', function (Blueprint $table) {
            $table->dropForeign(['assigned_to_user_id']);
            $table->dropColumn([
                'scheduled_at',
                'sent_at',
                'tracking_id',
                'read_count',
                'last_read_at',
                'snoozed_until',
                'assigned_to_user_id',
                'assigned_at'
            ]);
        });
    }
};
