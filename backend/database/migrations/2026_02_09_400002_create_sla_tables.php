<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sla_policies')) {
            Schema::create('sla_policies', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name', 255);
                $table->integer('response_time_minutes')->default(60);
                $table->integer('resolution_time_minutes')->default(480);
                $table->string('priority', 20)->default('medium');
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            });
        }

        Schema::table('work_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('work_orders', 'sla_policy_id')) {
                $table->unsignedBigInteger('sla_policy_id')->nullable();
                $table->timestamp('sla_due_at')->nullable();
                $table->timestamp('sla_responded_at')->nullable();
                $table->foreign('sla_policy_id')->references('id')->on('sla_policies')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['sla_policy_id']);
            $table->dropColumn(['sla_policy_id', 'sla_due_at', 'sla_responded_at']);
        });
        Schema::dropIfExists('sla_policies');
    }
};
