<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('technician_fund_requests')) {
            Schema::create('technician_fund_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('user_id');
                $table->decimal('amount', 10, 2);
                $table->string('reason', 500)->nullable();
                $table->string('status', 20)->default('pending');
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'user_id'], 'tech_fund_req_tenant_user_idx');
                $table->index(['tenant_id', 'status'], 'tech_fund_req_tenant_status_idx');

                if (Schema::hasTable('tenants')) {
                    $table->foreign('tenant_id')->references('id')->on('tenants')->onUpdate('cascade')->onDelete('cascade');
                }
                if (Schema::hasTable('users')) {
                    $table->foreign('user_id')->references('id')->on('users')->onUpdate('cascade')->onDelete('cascade');
                    $table->foreign('approved_by')->references('id')->on('users')->onUpdate('cascade')->onDelete('set null');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('technician_fund_requests');
    }
};
