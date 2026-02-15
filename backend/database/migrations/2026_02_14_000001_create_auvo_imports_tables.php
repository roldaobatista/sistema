<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('auvo_imports')) {
            Schema::create('auvo_imports', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id');
                $t->unsignedBigInteger('user_id');
                $t->string('entity_type', 30);
                $t->string('status', 20)->default('pending');
                $t->unsignedInteger('total_fetched')->default(0);
                $t->unsignedInteger('total_imported')->default(0);
                $t->unsignedInteger('total_updated')->default(0);
                $t->unsignedInteger('total_skipped')->default(0);
                $t->unsignedInteger('total_errors')->default(0);
                $t->json('error_log')->nullable();
                $t->json('imported_ids')->nullable();
                $t->string('duplicate_strategy', 20)->default('skip');
                $t->json('filters')->nullable();
                $t->timestamp('started_at')->nullable();
                $t->timestamp('completed_at')->nullable();
                $t->timestamp('last_synced_at')->nullable();
                $t->timestamps();

                $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $t->foreign('user_id')->references('id')->on('users');
                $t->index(['tenant_id', 'entity_type']);
                $t->index(['tenant_id', 'status']);
            });
        }

        if (!Schema::hasTable('auvo_id_mappings')) {
            Schema::create('auvo_id_mappings', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('tenant_id');
                $t->string('entity_type', 30);
                $t->unsignedBigInteger('auvo_id');
                $t->unsignedBigInteger('local_id')->nullable();
                $t->unsignedBigInteger('import_id')->nullable();
                $t->timestamps();

                $t->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $t->foreign('import_id')->references('id')->on('auvo_imports')->nullOnDelete();
                $t->unique(['tenant_id', 'entity_type', 'auvo_id']);
                $t->index(['tenant_id', 'entity_type', 'local_id']);
                $t->index(['import_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('auvo_id_mappings');
        Schema::dropIfExists('auvo_imports');
    }
};
