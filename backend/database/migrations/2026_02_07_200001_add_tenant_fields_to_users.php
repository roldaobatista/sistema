<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Adiciona campos ao users para multi-tenant e RBAC
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('tenant_id')->nullable()
                ->constrained()->nullOnDelete();
            $table->foreignId('current_tenant_id')->nullable()
                ->constrained('tenants')->nullOnDelete();
            $table->timestamp('last_login_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_tenant_id');
            $table->dropConstrainedForeignId('tenant_id');
            $table->dropColumn(['phone', 'is_active', 'last_login_at']);
        });
    }
};
