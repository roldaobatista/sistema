<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('crm_messages')) {
            Schema::create('crm_messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained();
                $table->foreignId('customer_id')->constrained();
                $table->foreignId('deal_id')->nullable()->constrained('crm_deals')->nullOnDelete();
                $table->foreignId('user_id')->nullable()->constrained();

                $table->enum('channel', ['whatsapp', 'email', 'sms']);
                $table->enum('direction', ['inbound', 'outbound']);
                $table->enum('status', ['pending', 'sent', 'delivered', 'read', 'failed'])->default('pending');

                $table->string('subject')->nullable();
                $table->text('body');
                $table->string('from_address')->nullable();
                $table->string('to_address')->nullable();

                $table->string('external_id')->nullable()->index();
                $table->string('provider')->nullable();

                $table->json('attachments')->nullable();
                $table->json('metadata')->nullable();

                $table->timestamp('sent_at')->nullable();
                $table->timestamp('delivered_at')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamp('failed_at')->nullable();
                $table->text('error_message')->nullable();

                $table->timestamps();

                $table->index(['tenant_id', 'customer_id', 'channel']);
                $table->index(['tenant_id', 'channel', 'status']);
            });
        }

        if (!Schema::hasTable('crm_message_templates')) {
            Schema::create('crm_message_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained();
                $table->string('name');
                $table->string('slug')->index();
                $table->enum('channel', ['whatsapp', 'email', 'sms']);
                $table->string('subject')->nullable();
                $table->text('body');
                $table->json('variables')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['tenant_id', 'slug']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_message_templates');
        Schema::dropIfExists('crm_messages');
    }
};
