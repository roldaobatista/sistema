<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('email_account_id')->constrained('email_accounts')->onUpdate('cascade')->onDelete('cascade');
            $table->string('message_id')->unique();
            $table->string('in_reply_to')->nullable()->index();
            $table->string('thread_id')->nullable()->index();
            $table->string('folder')->default('INBOX');
            $table->unsignedBigInteger('uid')->nullable();
            $table->string('from_address');
            $table->string('from_name')->nullable();
            $table->json('to_addresses');
            $table->json('cc_addresses')->nullable();
            $table->string('subject', 500);
            $table->longText('body_text')->nullable();
            $table->longText('body_html')->nullable();
            $table->string('snippet', 500)->nullable();
            $table->timestamp('date')->index();
            $table->boolean('is_read')->default(false);
            $table->boolean('is_starred')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->boolean('has_attachments')->default(false);

            // AI classification fields
            $table->string('ai_category')->nullable()->index();
            $table->text('ai_summary')->nullable();
            $table->string('ai_sentiment', 20)->nullable();
            $table->string('ai_priority', 20)->nullable();
            $table->string('ai_suggested_action', 50)->nullable();
            $table->decimal('ai_confidence', 3, 2)->nullable();
            $table->timestamp('ai_classified_at')->nullable();

            // Entity linking
            $table->foreignId('customer_id')->nullable()->constrained('customers')->onUpdate('cascade')->onDelete('set null');
            $table->nullableMorphs('linked');

            // Direction & status
            $table->string('direction')->default('inbound');
            $table->string('status')->default('new');

            $table->timestamps();

            $table->index(['email_account_id', 'uid']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'ai_category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('emails');
    }
};
