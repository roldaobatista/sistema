<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_notes', function (Blueprint $table) {
            $table->string('reference', 100)->nullable()->after('provider_id')->index();
            $table->string('nature_of_operation')->nullable()->after('total_amount');
            $table->string('cfop', 10)->nullable()->after('nature_of_operation');
            $table->json('items_data')->nullable()->after('cfop');
            $table->string('protocol_number', 50)->nullable()->after('items_data');
            $table->string('environment', 20)->default('homologation')->after('protocol_number');
            $table->boolean('contingency_mode')->default(false)->after('environment');
            $table->string('verification_code', 100)->nullable()->after('contingency_mode');
            $table->string('pdf_path')->nullable()->after('pdf_url');
            $table->string('xml_path')->nullable()->after('xml_url');
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_notes', function (Blueprint $table) {
            $table->dropColumn([
                'reference',
                'nature_of_operation',
                'cfop',
                'items_data',
                'protocol_number',
                'environment',
                'contingency_mode',
                'verification_code',
                'pdf_path',
                'xml_path',
            ]);
        });
    }
};
