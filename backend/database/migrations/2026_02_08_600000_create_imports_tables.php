<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('imports', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->unsignedBigInteger('user_id');
            $t->string('entity_type', 30); // customers, products, services, equipments
            $t->string('file_name');
            $t->unsignedInteger('total_rows')->default(0);
            $t->unsignedInteger('inserted')->default(0);
            $t->unsignedInteger('updated')->default(0);
            $t->unsignedInteger('skipped')->default(0);
            $t->unsignedInteger('errors')->default(0);
            $t->string('status', 20)->default('pending'); // pending, processing, done, failed
            $t->json('mapping')->nullable();
            $t->json('error_log')->nullable();
            $t->string('duplicate_strategy', 20)->default('skip'); // skip, update, create
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users');
            $t->index(['tenant_id', 'entity_type']);
        });

        Schema::create('import_templates', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('tenant_id');
            $t->string('entity_type', 30);
            $t->string('name', 100);
            $t->json('mapping');
            $t->timestamps();

            $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $t->unique(['tenant_id', 'entity_type', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_templates');
        Schema::dropIfExists('imports');
    }
};
