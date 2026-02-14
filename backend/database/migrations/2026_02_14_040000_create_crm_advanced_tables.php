<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('email_campaigns')) {
            Schema::create('email_campaigns', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name');
                $table->string('subject');
                $table->text('content');
                $table->string('segment')->default('all');
                $table->string('status')->default('draft');
                $table->timestamp('scheduled_at')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->integer('sent_count')->default(0);
                $table->integer('opened_count')->default(0);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('whatsapp_messages')) {
            Schema::create('whatsapp_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('customer_id')->nullable();
                $table->string('phone');
                $table->text('message');
                $table->string('template')->nullable();
                $table->string('status')->default('queued');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('self_service_quote_requests')) {
            Schema::create('self_service_quote_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('customer_name');
                $table->string('customer_email');
                $table->string('customer_phone');
                $table->json('items');
                $table->text('notes')->nullable();
                $table->string('status')->default('pending');
                $table->timestamp('created_at')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        // Add parent_quote_id and option_label to quotes if not exists
        if (Schema::hasTable('quotes')) {
            if (!Schema::hasColumn('quotes', 'parent_quote_id')) {
                Schema::table('quotes', function (Blueprint $table) {
                    $table->unsignedBigInteger('parent_quote_id')->nullable()->after('id');
                    $table->string('option_label')->nullable()->after('parent_quote_id');
                });
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('self_service_quote_requests');
        Schema::dropIfExists('whatsapp_messages');
        Schema::dropIfExists('email_campaigns');

        if (Schema::hasTable('quotes') && Schema::hasColumn('quotes', 'parent_quote_id')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->dropColumn(['parent_quote_id', 'option_label']);
            });
        }
    }
};
