<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('state_registration', 30)->nullable()->after('document')->comment('Inscrição Estadual (IE)');
            $table->string('municipal_registration', 30)->nullable()->after('state_registration')->comment('Inscrição Municipal (IM)');
            $table->string('cnae_code', 10)->nullable()->after('municipal_registration')->comment('CNAE principal');
            $table->string('cnae_description')->nullable()->after('cnae_code');
            $table->string('legal_nature')->nullable()->after('cnae_description')->comment('Natureza jurídica');
            $table->decimal('capital', 15, 2)->nullable()->after('legal_nature')->comment('Capital social');
            $table->boolean('simples_nacional')->nullable()->after('capital');
            $table->boolean('mei')->nullable()->after('simples_nacional');
            $table->string('company_status')->nullable()->after('mei')->comment('Situação cadastral (ATIVA, BAIXADA, etc.)');
            $table->date('opened_at')->nullable()->after('company_status')->comment('Data de início de atividade');
            $table->boolean('is_rural_producer')->default(false)->after('opened_at');
            $table->json('partners')->nullable()->after('is_rural_producer')->comment('Quadro societário');
            $table->json('secondary_activities')->nullable()->after('partners')->comment('CNAEs secundários');
            $table->json('enrichment_data')->nullable()->after('secondary_activities')->comment('Dados brutos do enriquecimento');
            $table->timestamp('enriched_at')->nullable()->after('enrichment_data');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'state_registration', 'municipal_registration',
                'cnae_code', 'cnae_description', 'legal_nature',
                'capital', 'simples_nacional', 'mei',
                'company_status', 'opened_at', 'is_rural_producer',
                'partners', 'secondary_activities',
                'enrichment_data', 'enriched_at',
            ]);
        });
    }
};
