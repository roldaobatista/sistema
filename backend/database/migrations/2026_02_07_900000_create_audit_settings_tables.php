<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('audit_logs')) {
            Schema::create('audit_logs', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id');
                $t->unsignedBigInteger('user_id')->nullable();
                $t->string('action', 30); // created, updated, deleted, login, logout, status_changed
                $t->string('auditable_type')->nullable(); // Model class
                $t->unsignedBigInteger('auditable_id')->nullable();
                $t->string('description');
                $t->json('old_values')->nullable();
                $t->json('new_values')->nullable();
                $t->string('ip_address', 45)->nullable();
                $t->string('user_agent')->nullable();
                $t->timestamp('created_at')->useCurrent();

                $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $t->foreign('user_id')->references('id')->on('users')->nullOnDelete();
                $t->index(['tenant_id', 'auditable_type', 'auditable_id']);
                $t->index(['tenant_id', 'created_at']);
            });
        }

        if (!Schema::hasTable('system_settings')) {
            Schema::create('system_settings', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id');
                $t->string('key', 100);
                $t->text('value')->nullable();
                $t->string('type', 20)->default('string'); // string, boolean, integer, json
                $t->string('group', 50)->default('general'); // general, os, financial, notification
                $t->timestamps();

                $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $t->unique(['tenant_id', 'key']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('audit_logs');
    }
};
