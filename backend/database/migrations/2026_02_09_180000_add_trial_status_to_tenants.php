<?php

use Illuminate\Database\Migrations\Migration;

/**
 * FIX-01: Originalmente corrigia ENUM para VARCHAR na tabela tenants.
 * A migração original (create_tenant_tables) foi corrigida diretamente
 * para usar string('status', 20) em vez de enum, tornando esta
 * migração desnecessária.
 */
return new class extends Migration {
    public function up(): void
    {
        // No-op: migração original já corrigida
    }

    public function down(): void
    {
        // No-op
    }
};
