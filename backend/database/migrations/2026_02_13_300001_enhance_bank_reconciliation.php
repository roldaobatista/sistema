<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bank_statements') && !Schema::hasColumn('bank_statements', 'bank_account_id')) {
            Schema::table('bank_statements', function (Blueprint $table) {
                $table->unsignedBigInteger('bank_account_id')->nullable();
                $table->foreign('bank_account_id')->references('id')->on('bank_accounts')->nullOnDelete();
            });
        }

        if (Schema::hasTable('bank_statement_entries') && !Schema::hasColumn('bank_statement_entries', 'possible_duplicate')) {
            Schema::table('bank_statement_entries', function (Blueprint $table) {
                $table->boolean('possible_duplicate')->default(false);
            });
        }
    }

    public function down(): void
    {
        Schema::table('bank_statements', function (Blueprint $table) {
            $table->dropForeign(['bank_account_id']);
            $table->dropColumn('bank_account_id');
        });

        Schema::table('bank_statement_entries', function (Blueprint $table) {
            $table->dropColumn('possible_duplicate');
        });
    }
};
