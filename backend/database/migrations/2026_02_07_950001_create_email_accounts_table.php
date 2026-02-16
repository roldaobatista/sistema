<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_accounts')) {
            return;
        }

        Schema::create('email_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('label');
            $table->string('email_address');
            $table->string('imap_host');
            $table->unsignedSmallInteger('imap_port')->default(993);
            $table->string('imap_encryption')->default('ssl');
            $table->text('imap_username');
            $table->text('imap_password');
            $table->string('smtp_host')->nullable();
            $table->unsignedSmallInteger('smtp_port')->nullable();
            $table->string('smtp_encryption')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_sync_at')->nullable();
            $table->unsignedBigInteger('last_sync_uid')->nullable();
            $table->string('sync_status')->default('idle');
            $table->text('sync_error')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'email_address']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_accounts');
    }
};
