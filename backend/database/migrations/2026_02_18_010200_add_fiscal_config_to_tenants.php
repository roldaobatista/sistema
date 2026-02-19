<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            if (!Schema::hasColumn('tenants', 'fiscal_regime')) {
                $table->tinyInteger('fiscal_regime')->default(1); // 1=Simples, 2=Presumido, 3=Real
            }
            if (!Schema::hasColumn('tenants', 'cnae_code')) {
                $table->string('cnae_code', 20)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'fiscal_certificate_path')) {
                $table->string('fiscal_certificate_path')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'fiscal_certificate_password')) {
                $table->text('fiscal_certificate_password')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'fiscal_certificate_expires_at')) {
                $table->date('fiscal_certificate_expires_at')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'fiscal_nfse_token')) {
                $table->string('fiscal_nfse_token')->nullable();
            }
            if (!Schema::hasColumn('tenants', 'fiscal_nfse_city')) {
                $table->string('fiscal_nfse_city', 50)->nullable();
            }
            if (!Schema::hasColumn('tenants', 'fiscal_nfe_series')) {
                $table->unsignedSmallInteger('fiscal_nfe_series')->default(1);
            }
            if (!Schema::hasColumn('tenants', 'fiscal_nfe_next_number')) {
                $table->unsignedInteger('fiscal_nfe_next_number')->default(1);
            }
            if (!Schema::hasColumn('tenants', 'fiscal_nfse_rps_series')) {
                $table->string('fiscal_nfse_rps_series', 10)->default('RPS');
            }
            if (!Schema::hasColumn('tenants', 'fiscal_nfse_rps_next_number')) {
                $table->unsignedInteger('fiscal_nfse_rps_next_number')->default(1);
            }
            if (!Schema::hasColumn('tenants', 'fiscal_environment')) {
                $table->string('fiscal_environment', 20)->default('homologation');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $cols = [
                'fiscal_regime', 'cnae_code',
                'fiscal_certificate_path', 'fiscal_certificate_password', 'fiscal_certificate_expires_at',
                'fiscal_nfse_token', 'fiscal_nfse_city',
                'fiscal_nfe_series', 'fiscal_nfe_next_number',
                'fiscal_nfse_rps_series', 'fiscal_nfse_rps_next_number',
                'fiscal_environment',
            ];

            $existing = array_filter($cols, fn ($c) => Schema::hasColumn('tenants', $c));
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};
