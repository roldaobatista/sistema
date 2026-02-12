<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Grupos de permissões (para organizar no UI)
        Schema::create('permission_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable()->index();
            $table->unsignedSmallInteger('order')->default(0);
            $table->timestamps();
        });

        // Adiciona campos extras à tabela permissions do Spatie
        Schema::table('permissions', function (Blueprint $table) {
            $table->foreignId('group_id')->nullable()->after('guard_name')
                ->constrained('permission_groups')->nullOnDelete();
            $table->enum('criticality', ['LOW', 'MED', 'HIGH'])->default('MED')
                ->after('group_id');
        });

        // Audit logs
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 50); // ex: create, update, delete, login
            $table->string('entity_type', 100);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('payload_json')->nullable();
            $table->string('ip', 50)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'created_at']);
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('group_id');
            $table->dropColumn('criticality');
        });
        Schema::dropIfExists('permission_groups');
    }
};
