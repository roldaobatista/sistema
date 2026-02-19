<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('contracts')) {
            Schema::create('contracts', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id');
                $t->unsignedBigInteger('customer_id');
                $t->string('number', 30)->nullable();
                $t->string('name');
                $t->text('description')->nullable();
                $t->string('status', 20)->default('active'); // active, expired, cancelled
                $t->date('start_date')->nullable();
                $t->date('end_date')->nullable();
                $t->boolean('is_active')->default(true);
                $t->timestamps();
                $t->softDeletes();

                $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $t->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
                $t->index(['tenant_id', 'is_active']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
