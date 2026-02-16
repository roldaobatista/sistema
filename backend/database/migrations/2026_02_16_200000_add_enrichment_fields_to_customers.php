<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('state_registration', 30)->nullable()->comment('Inscrição Estadual (IE)');
            $table->string('municipal_registration', 30)->nullable()->comment('Inscrição Municipal (IM)');
            $table->string('cnae_code', 10)->nullable()->comment('CNAE principal');
            $table->string('cnae_description')->nullable();
            $table->string('legal_nature')->nullable()->comment('Natureza jurídica');
            $table->decimal('capital', 15, 2)->nullable()->comment('Capital social');
            $table->boolean('simples_nacional')->nullable();
            $table->boolean('mei')->nullable();
            $table->string('company_status')->nullable()->comment('Situação cadastral (ATIVA, BAIXADA, etc.)');
            $table->date('opened_at')->nullable()->comment('Data de início de atividade');
            $table->boolean('is_rural_producer')->default(false);
            $table->json('partners')->nullable()->comment('Quadro societário');
            $table->json('secondary_activities')->nullable()->comment('CNAEs secundários');
            $table->json('enrichment_data')->nullable()->comment('Dados brutos do enriquecimento');
            $table->timestamp('enriched_at')->nullable();
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
