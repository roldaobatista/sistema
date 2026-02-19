<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('fiscal_notes')) {
            return;
        }

        Schema::table('fiscal_notes', function (Blueprint $table) {
            if (!Schema::hasColumn('fiscal_notes', 'reference')) {
                $table->string('reference', 100)->nullable()->index();
            }
            if (!Schema::hasColumn('fiscal_notes', 'nature_of_operation')) {
                $table->string('nature_of_operation')->nullable();
            }
            if (!Schema::hasColumn('fiscal_notes', 'cfop')) {
                $table->string('cfop', 10)->nullable();
            }
            if (!Schema::hasColumn('fiscal_notes', 'items_data')) {
                $table->json('items_data')->nullable();
            }
            if (!Schema::hasColumn('fiscal_notes', 'protocol_number')) {
                $table->string('protocol_number', 50)->nullable();
            }
            if (!Schema::hasColumn('fiscal_notes', 'environment')) {
                $table->string('environment', 20)->default('homologation');
            }
            if (!Schema::hasColumn('fiscal_notes', 'contingency_mode')) {
                $table->boolean('contingency_mode')->default(false);
            }
            if (!Schema::hasColumn('fiscal_notes', 'verification_code')) {
                $table->string('verification_code', 100)->nullable();
            }
            if (!Schema::hasColumn('fiscal_notes', 'pdf_path')) {
                $table->string('pdf_path')->nullable();
            }
            if (!Schema::hasColumn('fiscal_notes', 'xml_path')) {
                $table->string('xml_path')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('fiscal_notes')) {
            return;
        }

        Schema::table('fiscal_notes', function (Blueprint $table) {
            $cols = [
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
            ];

            $existing = array_filter($cols, fn ($col) => Schema::hasColumn('fiscal_notes', $col));
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};
